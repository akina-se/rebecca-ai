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

export const downloadImage = async (
    url: string,
    allowedDomains?: string[]
): Promise<{ buffer: Buffer; mimeType: string }> => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error(`Invalid protocol for image download: ${url}`);
    }

    if (allowedDomains && allowedDomains.length > 0) {
        if (!isAllowedDomain(parsedUrl.hostname, allowedDomains)) {
            throw new Error(`Disallowed image host "${parsedUrl.hostname}" for image download: ${url}`);
        }
    }

    if (url.includes('..') || parsedUrl.pathname.includes('..')) {
        throw new Error(`Path traversal detected in image download: ${url}`);
    }

    const response = await fetch(parsedUrl.toString());
    if (!response.ok) {
        throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
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
