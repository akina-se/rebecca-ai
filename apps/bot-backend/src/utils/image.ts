/**
 * Downloads an image from a given URL and returns its binary data along with the inferred MIME type.
 *
 * This function is useful for fetching remote image assets to be processed or uploaded.
 *
 * @param url - The absolute URL of the image to download.
 * @param allowedDomains - Optional list of permitted domain suffixes to restrict downloads.
 * @returns A Promise that resolves to an object containing the raw image `buffer` and its `mimeType`.
 * @throws {Error} If the HTTP request fails, protocol is invalid, domain is disallowed, or response status is not OK.
 */

/**
 * Checks whether a given hostname matches an allowed domain or is a subdomain of it.
 *
 * @param hostname - The hostname to validate (e.g. 'pbs.twimg.com').
 * @param allowedDomains - List of allowed base domains or hosts (e.g. ['twimg.com', 'x.com']).
 * @returns True if the hostname matches or is a valid subdomain of an allowed domain.
 */
export const isAllowedDomain = (hostname: string, allowedDomains: string[]): boolean => {
    const normalized = hostname.toLowerCase();
    return allowedDomains.some((domain) => {
        const clean = domain.trim().toLowerCase();
        return clean.length > 0 && (normalized === clean || normalized.endsWith(`.${clean}`));
    });
};

/** Default allowlist of trusted image hosts when no explicit list is passed. */
export const DEFAULT_ALLOWED_IMAGE_DOMAINS = [
    'twimg.com',
    'twitter.com',
    'x.com',
    'storage.googleapis.com',
];

/** Maximum permitted remote image download size in bytes (15 MB). */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Rejects loopback, link-local, cloud metadata, and RFC 1918 private IPv4/IPv6 literals.
 */
export const isPrivateOrReservedHost = (hostname: string): boolean => {
    const lower = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (
        lower === 'localhost' ||
        lower.endsWith('.local') ||
        lower.endsWith('.internal') ||
        lower === 'metadata.google.internal' ||
        lower === '::1' ||
        lower === '0.0.0.0' ||
        lower.startsWith('fe80:') ||
        lower.startsWith('fc') ||
        lower.startsWith('fd')
    ) {
        return true;
    }
    const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
        if (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        ) {
            return true;
        }
    }
    return false;
};

export const downloadImage = async (
    url: string,
    allowedDomains: string[] = DEFAULT_ALLOWED_IMAGE_DOMAINS
): Promise<{ buffer: Buffer; mimeType: string }> => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
        throw new Error(`Invalid protocol for image download (https required): ${url}`);
    }

    if (isPrivateOrReservedHost(parsedUrl.hostname)) {
        throw new Error(`Disallowed private or reserved image host "${parsedUrl.hostname}" for image download: ${url}`);
    }

    if (allowedDomains.length === 0 || !isAllowedDomain(parsedUrl.hostname, allowedDomains)) {
        throw new Error(`Disallowed image host "${parsedUrl.hostname}" for image download: ${url}`);
    }

    if (url.includes('..') || parsedUrl.pathname.includes('..')) {
        throw new Error(`Path traversal detected in image download: ${url}`);
    }

    const response = await fetch(parsedUrl.toString(), {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
        throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
    }

    const contentLengthHeader = typeof response.headers?.get === 'function'
        ? response.headers.get('content-length')
        : null;
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_IMAGE_BYTES) {
        throw new Error(`Image exceeds maximum allowed size (${MAX_IMAGE_BYTES} bytes): ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error(`Image exceeds maximum allowed size (${MAX_IMAGE_BYTES} bytes): ${url}`);
    }
    
    const contentTypeHeader = response.headers.get('content-type');
    let mimeType = 'image/jpeg';
    if (contentTypeHeader) {
        const clean = contentTypeHeader.split(';')[0].trim().toLowerCase();
        if (clean.startsWith('image/')) {
            mimeType = clean;
        } else {
            throw new Error(`Invalid non-image content-type "${contentTypeHeader}" received when downloading from ${url}`);
        }
    }
    
    return { buffer, mimeType };
};
