/**
 * Downloads an image from a given URL and returns its binary data along with the inferred MIME type.
 *
 * This function is useful for fetching remote image assets to be processed or uploaded.
 *
 * @param url - The absolute URL of the image to download.
 * @returns A Promise that resolves to an object containing the raw image `buffer` and its `mimeType`.
 * @throws {Error} If the HTTP request fails or the response status is not OK.
 */
/**
 * Allowed domains and suffix patterns for external image downloading (SSRF prevention).
 */
export const isAllowedImageHost = (hostname: string): boolean => {
    const lower = hostname.toLowerCase();
    return (
        lower === 'pbs.twimg.com' ||
        lower.endsWith('.twimg.com') ||
        lower === 'ton.twitter.com' ||
        lower.endsWith('.twitter.com') ||
        lower === 'example.com' ||
        lower.endsWith('.example.com')
    );
};

export const downloadImage = async (url: string): Promise<{ buffer: Buffer; mimeType: string }> => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error(`Invalid protocol for image download: ${url}`);
    }
    if (!isAllowedImageHost(parsedUrl.hostname)) {
        throw new Error(`Disallowed image host "${parsedUrl.hostname}" for image download: ${url}`);
    }

    const response = await fetch(parsedUrl.href);
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


