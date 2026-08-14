/**
 * Downloads an image from a given URL and returns its binary data along with the inferred MIME type.
 *
 * This function is useful for fetching remote image assets to be processed or uploaded.
 *
 * @param url - The absolute URL of the image to download.
 * @returns A Promise that resolves to an object containing the raw image `buffer` and its `mimeType`.
 * @throws {Error} If the HTTP request fails or the response status is not OK.
 */
export const downloadImage = async (url: string): Promise<{ buffer: Buffer; mimeType: string }> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    return { buffer, mimeType };
};


