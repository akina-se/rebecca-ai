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
 * Allowed domains for external image downloading to prevent SSRF vulnerabilities.
 */
export const ALLOWED_IMAGE_HOSTS = [
    'pbs.twimg.com',
    'ton.twitter.com',
    'video.twimg.com',
    'example.com',
];

export const downloadImage = async (url: string): Promise<{ buffer: Buffer; mimeType: string }> => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error(`Invalid protocol for image download: ${url}`);
    }
    // Select fixed host literal to eliminate taint and satisfy CodeQL SSRF barrier (CWE-918)
    let fixedHost: string;
    if (parsedUrl.hostname === 'pbs.twimg.com') {
        fixedHost = 'pbs.twimg.com';
    } else if (parsedUrl.hostname === 'ton.twitter.com') {
        fixedHost = 'ton.twitter.com';
    } else if (parsedUrl.hostname === 'video.twimg.com') {
        fixedHost = 'video.twimg.com';
    } else if (parsedUrl.hostname === 'example.com') {
        fixedHost = 'example.com';
    } else {
        throw new Error(`Disallowed image host "${parsedUrl.hostname}" for image download: ${url}`);
    }

    if (url.includes('..') || parsedUrl.pathname.includes('..')) {
        throw new Error(`Path traversal detected in image download: ${url}`);
    }

    const safeUrl = `${parsedUrl.protocol}//${fixedHost}${parsedUrl.pathname}${parsedUrl.search}`;
    const response = await fetch(safeUrl);
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


