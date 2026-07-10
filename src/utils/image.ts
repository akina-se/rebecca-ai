/**
 * Downloads an image from a URL and returns it as a Buffer along with its MIME type.
 * 
 * @param url - The URL of the image.
 * @returns A promise resolving to an object containing the buffer and mimeType.
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
