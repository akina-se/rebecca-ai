import { Firestore } from '@google-cloud/firestore';
import {
  importFollowersFromArchive,
  parseFollowerArchiveContent,
  parseImportCliArgs,
} from '../../../src/features/onboarding/archiveImporter';

function createFakeFirestore(existingIds: string[]) {
  const committedWrites: Array<Array<{ id: string; data: unknown }>> = [];
  const batchMock = jest.fn(() => {
    const writes: Array<{ id: string; data: unknown }> = [];
    return {
      set: (docRef: { id: string }, data: unknown) => {
        writes.push({ id: docRef.id, data });
      },
      commit: async () => {
        committedWrites.push(writes);
      },
    };
  });

  const collectionRef = {
    withConverter: () => ({
      select: () => ({
        get: async () => ({
          docs: existingIds.map((id) => ({ id })),
        }),
      }),
      doc: (id: string) => ({ id }),
    }),
  };

  const firestore = {
    collection: jest.fn(() => collectionRef),
    batch: batchMock,
  } as unknown as Firestore;

  return { firestore, batchMock, committedWrites };
}

describe('archiveImporter', () => {
  describe('parseFollowerArchiveContent', () => {
    it('parses X Data Archive follower.js assignment and deduplicates IDs', () => {
      const jsPayload = `window.YTD.follower.part0 = [
        { "follower": { "accountId": "1001", "userLink": "https://twitter.com/intent/user?user_id=1001" } },
        { "follower": { "accountId": "1002", "userLink": "https://twitter.com/intent/user?user_id=1002" } },
        { "follower": { "accountId": "1001" } }
      ];`;

      expect(parseFollowerArchiveContent(jsPayload)).toEqual(['1001', '1002']);
    });

    it('parses plain JSON arrays across supported entry shapes', () => {
      const jsonPayload = JSON.stringify([
        { follower: { accountId: ' 2001 ' } },
        { accountId: '2002' },
        { id: '2003' },
        '2004',
      ]);

      expect(parseFollowerArchiveContent(jsonPayload)).toEqual(['2001', '2002', '2003', '2004']);
    });

    it('throws on empty, invalid JSON, or non-array inputs', () => {
      expect(() => parseFollowerArchiveContent('   ')).toThrow('Archive content is empty');
      expect(() => parseFollowerArchiveContent('window.YTD.follower.part0 = {bad')).toThrow(
        'Failed to parse follower archive as JSON',
      );
      expect(() => parseFollowerArchiveContent('{"accountId":"123"}')).toThrow(
        'Follower archive JSON root must be an array',
      );
    });

    it('throws when any entry has missing or non-numeric accountId', () => {
      expect(() => parseFollowerArchiveContent('[{"follower":{"accountId":"abc"}}]')).toThrow(
        'Invalid follower entry at index 0',
      );
      expect(() => parseFollowerArchiveContent('[12345]')).toThrow(
        'Invalid follower entry at index 0',
      );
    });
  });

  describe('importFollowersFromArchive', () => {
    it('defaults to dry-run and counts existing vs missing without committing writes', async () => {
      const { firestore, batchMock } = createFakeFirestore(['1001', '9999']);

      const result = await importFollowersFromArchive(firestore, ['1001', '1002', '1003']);

      expect(result).toEqual({
        totalParsed: 3,
        alreadyExisting: 1,
        newlyInserted: 2,
        dryRun: true,
        batchesCommitted: 0,
      });
      expect(batchMock).not.toHaveBeenCalled();
    });

    it('commits missing followers in bounded chunks with SKIPPED status when dryRun is false', async () => {
      const { firestore, committedWrites } = createFakeFirestore(['1002']);

      const result = await importFollowersFromArchive(
        firestore,
        ['1001', '1002', '1003', '1004', '1005', '1006'],
        {
          dryRun: false,
          batchSize: 2,
          timestamp: '2026-02-01T00:00:00.000Z',
        },
      );

      expect(result).toEqual({
        totalParsed: 6,
        alreadyExisting: 1,
        newlyInserted: 5,
        dryRun: false,
        batchesCommitted: 3,
      });
      expect(committedWrites.map((chunk) => chunk.map((w) => w.id))).toEqual([
        ['1001', '1003'],
        ['1004', '1005'],
        ['1006'],
      ]);
      expect(committedWrites[0][0].data).toEqual({
        userId: '1001',
        timestamp: '2026-02-01T00:00:00.000Z',
        listStatus: 'SKIPPED',
      });
    });

    it('skips WriteBatch commits when all archive followers already exist', async () => {
      const { firestore, batchMock } = createFakeFirestore(['1001', '1002']);

      const result = await importFollowersFromArchive(firestore, ['1001', '1002'], { dryRun: false });

      expect(result).toEqual({
        totalParsed: 2,
        alreadyExisting: 2,
        newlyInserted: 0,
        dryRun: false,
        batchesCommitted: 0,
      });
      expect(batchMock).not.toHaveBeenCalled();
    });

    it('validates timestamp and batchSize boundaries', async () => {
      const { firestore } = createFakeFirestore([]);

      await expect(
        importFollowersFromArchive(firestore, ['1001'], { timestamp: 'not-a-date' }),
      ).rejects.toThrow('Invalid archive backfill timestamp');

      await expect(
        importFollowersFromArchive(firestore, ['1001'], { batchSize: 0 }),
      ).rejects.toThrow('Invalid Firestore batchSize 0');

      await expect(
        importFollowersFromArchive(firestore, ['1001'], { batchSize: 501 }),
      ).rejects.toThrow('Invalid Firestore batchSize 501');

      await expect(
        importFollowersFromArchive(firestore, ['1001'], { batchSize: 1.5 }),
      ).rejects.toThrow('Invalid Firestore batchSize 1.5');
    });
  });

  describe('parseImportCliArgs', () => {
    it('parses file, mode, and timestamp flags', () => {
      expect(parseImportCliArgs(['--file', './follower.js'])).toEqual({
        filePath: './follower.js',
        dryRun: true,
        timestamp: '2026-01-01T00:00:00.000Z',
      });

      expect(
        parseImportCliArgs([
          '-f',
          './data/follower.js',
          '--apply',
          '--dry-run',
          '--apply',
          '--timestamp',
          '2026-03-01T00:00:00.000Z',
        ]),
      ).toEqual({
        filePath: './data/follower.js',
        dryRun: false,
        timestamp: '2026-03-01T00:00:00.000Z',
      });
    });

    it('throws on missing required file, missing option values, or unknown flags', () => {
      expect(() => parseImportCliArgs([])).toThrow('Missing required argument: --file');
      expect(() => parseImportCliArgs(['--file'])).toThrow('Missing value after --file');
      expect(() => parseImportCliArgs(['--file', 'a.js', '--timestamp'])).toThrow(
        'Missing value after --timestamp',
      );
      expect(() => parseImportCliArgs(['--file', 'a.js', '--bogus'])).toThrow(
        'Unknown CLI argument: --bogus',
      );
    });
  });
});
