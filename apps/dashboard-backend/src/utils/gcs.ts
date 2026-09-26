import { logger } from './logger';

export interface ParsedGcsUrl {
  readonly bucket: string | null;
  readonly objectPath: string;
}

export type GcsParseResult =
  | {
      readonly success: true;
      readonly bucket: string | null;
      readonly objectPath: string;
    }
  | {
      readonly success: false;
      readonly reason: 'NOT_GCS_URL';
    }
  | {
      readonly success: false;
      readonly reason: 'MALFORMED_GCS_URL';
      readonly error: string;
    };

const GCS_HOST_CANONICAL = 'storage.googleapis.com';
const GCS_HOST_CONSOLE = 'storage.cloud.google.com';
const GCS_HOST_SUBDOMAIN_SUFFIX = '.storage.googleapis.com';

/**
 * Parses a candidate URL/URI into a structured Result object according to Google Cloud Storage specifications.
 * Differentiates between non-GCS URLs (valid external inputs) and malformed GCS URLs (configuration or data errors).
 *
 * @param rawUrl - The candidate URL or URI string to evaluate.
 * @returns GcsParseResult containing extracted bucket/path or failure reason.
 */
export function parseGcsUrlResult(rawUrl: unknown): GcsParseResult {
  if (typeof rawUrl !== 'string') {
    return { success: false, reason: 'NOT_GCS_URL' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { success: false, reason: 'NOT_GCS_URL' };
  }

  // 1. GS URI scheme: gs://<bucket>/<objectPath>
  if (trimmed.startsWith('gs://')) {
    const withoutScheme = trimmed.slice(5).replace(/^\/+/, '');
    if (!withoutScheme) {
      const error = 'Missing bucket name and object path in gs:// URI';
      logger.warn(error, { rawUrl: trimmed });
      return { success: false, reason: 'MALFORMED_GCS_URL', error };
    }

    const firstSlashIndex = withoutScheme.indexOf('/');
    if (firstSlashIndex === -1) {
      const error = 'Missing object path in gs:// URI';
      logger.warn(error, { rawUrl: trimmed });
      return { success: false, reason: 'MALFORMED_GCS_URL', error };
    }

    const bucket = withoutScheme.slice(0, firstSlashIndex);
    const objectPath = withoutScheme.slice(firstSlashIndex + 1).replace(/^\/+/, '');
    if (!bucket) {
      const error = 'Empty bucket name in gs:// URI';
      logger.warn(error, { rawUrl: trimmed });
      return { success: false, reason: 'MALFORMED_GCS_URL', error };
    }
    if (!objectPath) {
      const error = 'Empty object path in gs:// URI';
      logger.warn(error, { rawUrl: trimmed });
      return { success: false, reason: 'MALFORMED_GCS_URL', error };
    }

    return { success: true, bucket, objectPath };
  }

  // 2. HTTP/HTTPS URL parsing
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return { success: false, reason: 'NOT_GCS_URL' };
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/^\/+/, '');

    // Canonical path-style: storage.googleapis.com/<bucket>/<objectPath>
    // or Cloud Console viewer: storage.cloud.google.com/<bucket>/<objectPath>
    if (hostname === GCS_HOST_CANONICAL || hostname === GCS_HOST_CONSOLE) {
      const parts = pathname.split('/');
      const bucket = parts.shift() || null;
      const objectPath = parts.join('/');

      if (!bucket) {
        const error = `Missing bucket name in ${hostname} URL`;
        logger.warn(error, { rawUrl: trimmed });
        return { success: false, reason: 'MALFORMED_GCS_URL', error };
      }
      if (!objectPath) {
        const error = `Missing object path in ${hostname} URL`;
        logger.warn(error, { rawUrl: trimmed });
        return { success: false, reason: 'MALFORMED_GCS_URL', error };
      }

      return { success: true, bucket, objectPath };
    }

    // Virtual-hosted-style: <bucket>.storage.googleapis.com/<objectPath>
    if (hostname.endsWith(GCS_HOST_SUBDOMAIN_SUFFIX)) {
      const bucket = hostname.slice(0, -GCS_HOST_SUBDOMAIN_SUFFIX.length);
      if (!bucket) {
        const error = 'Missing bucket prefix in virtual-hosted GCS URL';
        logger.warn(error, { rawUrl: trimmed });
        return { success: false, reason: 'MALFORMED_GCS_URL', error };
      }
      if (!pathname) {
        const error = 'Missing object path in virtual-hosted GCS URL';
        logger.warn(error, { rawUrl: trimmed });
        return { success: false, reason: 'MALFORMED_GCS_URL', error };
      }

      return { success: true, bucket, objectPath: pathname };
    }

    return { success: false, reason: 'NOT_GCS_URL' };
  } catch {
    return { success: false, reason: 'NOT_GCS_URL' };
  }
}

/**
 * Returns the parsed bucket and object path if the input is a valid GCS URL, or null otherwise.
 *
 * @param rawUrl - The candidate URL or URI string.
 * @returns ParsedGcsUrl if valid; null if non-GCS or malformed.
 */
export function parseGcsUrl(rawUrl: unknown): ParsedGcsUrl | null {
  const result = parseGcsUrlResult(rawUrl);
  return result.success ? { bucket: result.bucket, objectPath: result.objectPath } : null;
}

/**
 * Evaluates whether a given input is a recognized Google Cloud Storage URL/URI.
 * Matches both valid GCS URLs and malformed GCS references intended for internal storage.
 *
 * @param rawUrl - The candidate URL or URI string.
 * @returns True if the string targets GCS; false if it targets external services or is invalid.
 */
export function isGcsUrl(rawUrl: unknown): boolean {
  const result = parseGcsUrlResult(rawUrl);
  return result.success || result.reason === 'MALFORMED_GCS_URL';
}

/**
 * Extracts the object path within the GCS bucket from any supported GCS URL/URI format.
 *
 * @param rawUrl - The candidate URL or URI string.
 * @returns Object path if valid; null if not a valid GCS URL.
 */
export function extractGcsObjectPath(rawUrl: unknown): string | null {
  const result = parseGcsUrlResult(rawUrl);
  return result.success ? result.objectPath : null;
}
