/**
 * Google Cloud Storage (GCS) URL parser and utility.
 *
 * Supports canonical GCS URL specifications:
 * - GS URI: gs://<bucket>/<objectPath>
 * - Path-style HTTPS: https://storage.googleapis.com/<bucket>/<objectPath>
 * - Virtual-hosted-style HTTPS: https://<bucket>.storage.googleapis.com/<objectPath>
 * - Cloud Console Browser URL: https://storage.cloud.google.com/<bucket>/<objectPath>
 */

export interface ParsedGcsUrl {
  readonly bucket: string | null;
  readonly objectPath: string;
}

const GCS_HOST_CANONICAL = 'storage.googleapis.com';
const GCS_HOST_CONSOLE = 'storage.cloud.google.com';
const GCS_HOST_SUBDOMAIN_SUFFIX = '.storage.googleapis.com';

/**
 * Parses any supported GCS URL/URI format into its constituent bucket and object path.
 *
 * @param rawUrl - The candidate URL string to parse.
 * @returns ParsedGcsUrl with bucket and normalized object path, or null if the input is invalid or not a recognized GCS URL.
 */
export function parseGcsUrl(rawUrl: unknown): ParsedGcsUrl | null {
  if (typeof rawUrl !== 'string') {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('gs://')) {
    const withoutScheme = trimmed.slice(5).replace(/^\/+/, '');
    const firstSlashIndex = withoutScheme.indexOf('/');
    if (firstSlashIndex <= 0) {
      return null;
    }
    const bucket = withoutScheme.slice(0, firstSlashIndex);
    const objectPath = withoutScheme.slice(firstSlashIndex + 1).replace(/^\/+/, '');
    if (!objectPath) {
      return null;
    }
    return { bucket, objectPath };
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/^\/+/, '');

    if (hostname === GCS_HOST_CANONICAL || hostname === GCS_HOST_CONSOLE) {
      const parts = pathname.split('/');
      if (parts.length < 2) {
        return null;
      }
      const bucket = parts.shift() || null;
      const objectPath = parts.join('/');
      if (!bucket || !objectPath) {
        return null;
      }
      return { bucket, objectPath };
    }

    if (hostname.endsWith(GCS_HOST_SUBDOMAIN_SUFFIX)) {
      const bucket = hostname.slice(0, -GCS_HOST_SUBDOMAIN_SUFFIX.length);
      if (!bucket || !pathname) {
        return null;
      }
      return { bucket, objectPath: pathname };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the given string is a valid GCS URL or URI.
 *
 * @param rawUrl - The candidate URL string to evaluate.
 * @returns True if the string is a recognized GCS URL/URI; false otherwise.
 */
export function isGcsUrl(rawUrl: unknown): boolean {
  return parseGcsUrl(rawUrl) !== null;
}

/**
 * Extracts the object path within the GCS bucket from any supported GCS URL/URI format.
 *
 * @param rawUrl - The candidate URL string.
 * @returns The object path if valid, or null if the URL is not a recognized GCS URL.
 */
export function extractGcsObjectPath(rawUrl: unknown): string | null {
  const parsed = parseGcsUrl(rawUrl);
  return parsed ? parsed.objectPath : null;
}
