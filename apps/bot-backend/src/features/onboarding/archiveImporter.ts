import { Firestore } from '@google-cloud/firestore';
import { getCollections } from '@rebecca/db';
import { ProcessedFollower } from '@rebecca/types';

const DEFAULT_BACKFILL_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const DEFAULT_BATCH_SIZE = 400;
const MAX_FIRESTORE_BATCH_SIZE = 500;
const YTD_FOLLOWER_PREFIX_REGEX = /^\s*window\.YTD\.follower[^=]*=\s*/;
const NUMERIC_ID_REGEX = /^\d+$/;

/**
 * Options controlling how parsed archive followers are written to Firestore.
 */
export interface ArchiveImportOptions {
  /** When true (default), computes diffs without mutating Firestore. */
  dryRun?: boolean;
  /**
   * ISO 8601 timestamp assigned to newly inserted backfill records.
   * Defaults to a historical pre-window date (`2026-01-01T00:00:00.000Z`) so
   * Dashboard current-period follower growth charts are not artificially inflated.
   */
  timestamp?: string;
  /** Number of documents per Firestore WriteBatch (1..500, defaults to 400). */
  batchSize?: number;
}

/**
 * Summary counts returned by {@link importFollowersFromArchive}.
 */
export interface ArchiveImportResult {
  totalParsed: number;
  alreadyExisting: number;
  newlyInserted: number;
  dryRun: boolean;
  batchesCommitted: number;
}

/**
 * Parsed CLI configuration for the follower archive backfill command.
 */
export interface ArchiveImportCliArgs {
  filePath: string;
  dryRun: boolean;
  timestamp: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractFollowerId(entry: unknown, index: number): string {
  let candidate: unknown;

  if (typeof entry === 'string') {
    candidate = entry;
  } else if (isPlainRecord(entry)) {
    if (isPlainRecord(entry.follower)) {
      candidate = entry.follower.accountId;
    } else if ('accountId' in entry) {
      candidate = entry.accountId;
    } else if ('id' in entry) {
      candidate = entry.id;
    }
  }

  if (typeof candidate !== 'string' || !NUMERIC_ID_REGEX.test(candidate.trim())) {
    throw new Error(`Invalid follower entry at index ${index}: expected numeric accountId`);
  }

  return candidate.trim();
}

/**
 * Parses an X Data Archive `follower.js` (or plain JSON array) payload into deduplicated
 * numeric X user ID strings without evaluating arbitrary JavaScript.
 *
 * Supported formats:
 * - X Data Archive JS assignment (`window.YTD.follower.part0 = [{ follower: { accountId } }]`)
 * - JSON array of `{ follower: { accountId } }`, `{ accountId }`, `{ id }`, or numeric string IDs
 *
 * @throws Error When the input is empty, invalid JSON, not an array, or contains malformed entries.
 */
export function parseFollowerArchiveContent(rawContent: string): string[] {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new Error('Archive content is empty');
  }

  const withoutPrefix = trimmed.replace(YTD_FOLLOWER_PREFIX_REGEX, '').replace(/;\s*$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutPrefix);
  } catch (err) {
    throw new Error('Failed to parse follower archive as JSON', { cause: err });
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Follower archive JSON root must be an array');
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const id = extractFollowerId(parsed[i], i);
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

/**
 * Inserts missing follower IDs into Firestore `processed_followers` with `listStatus: 'SKIPPED'`
 * so they become eligible for `RandomEngagementUseCase` without calling the X API or overwriting
 * existing follower records.
 *
 * @throws Error When `timestamp` is not a valid ISO timestamp or `batchSize` is outside `1..500`.
 */
export async function importFollowersFromArchive(
  firestore: Firestore,
  followerIds: readonly string[],
  options: ArchiveImportOptions = {},
): Promise<ArchiveImportResult> {
  const dryRun = options.dryRun ?? true;
  const timestamp = options.timestamp ?? DEFAULT_BACKFILL_TIMESTAMP;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`Invalid archive backfill timestamp: ${timestamp}`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_FIRESTORE_BATCH_SIZE) {
    throw new Error(
      `Invalid Firestore batchSize ${batchSize}: must be an integer between 1 and ${MAX_FIRESTORE_BATCH_SIZE}`,
    );
  }

  const db = getCollections(firestore);
  const existingSnapshot = await db.processedFollowers.select().get();
  const existingIds = new Set(existingSnapshot.docs.map((doc) => doc.id));

  const missingIds = followerIds.filter((id) => !existingIds.has(id));
  const alreadyExisting = followerIds.length - missingIds.length;

  if (dryRun || missingIds.length === 0) {
    return {
      totalParsed: followerIds.length,
      alreadyExisting,
      newlyInserted: missingIds.length,
      dryRun,
      batchesCommitted: 0,
    };
  }

  let batchesCommitted = 0;
  for (let offset = 0; offset < missingIds.length; offset += batchSize) {
    const chunk = missingIds.slice(offset, offset + batchSize);
    const batch = firestore.batch();
    for (const userId of chunk) {
      const record: ProcessedFollower = {
        userId,
        timestamp,
        listStatus: 'SKIPPED',
      };
      batch.set(db.processedFollowers.doc(userId), record);
    }
    await batch.commit();
    batchesCommitted++;
  }

  return {
    totalParsed: followerIds.length,
    alreadyExisting,
    newlyInserted: missingIds.length,
    dryRun: false,
    batchesCommitted,
  };
}

/**
 * Parses CLI flags (`--file <path>`, `--apply`, `--dry-run`, `--timestamp <iso>`) for the
 * archive backfill script, defaulting to dry-run mode for safety.
 *
 * @throws Error When `--file` is missing or an unknown/incomplete flag is supplied.
 */
export function parseImportCliArgs(argv: readonly string[]): ArchiveImportCliArgs {
  let filePath = '';
  let dryRun = true;
  let timestamp = DEFAULT_BACKFILL_TIMESTAMP;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file' || arg === '-f') {
      const next = argv[++i];
      if (!next) {
        throw new Error(`Missing value after ${arg}`);
      }
      filePath = next;
    } else if (arg === '--apply') {
      dryRun = false;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--timestamp') {
      const next = argv[++i];
      if (!next) {
        throw new Error('Missing value after --timestamp');
      }
      timestamp = next;
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (!filePath.trim()) {
    throw new Error('Missing required argument: --file <path/to/follower.js>');
  }

  return { filePath, dryRun, timestamp };
}
