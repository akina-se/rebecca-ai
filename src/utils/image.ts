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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const analyzeTweetImages = async (mediaKeys: string[] | undefined, mediaIncludes: any[] | undefined, gemini: any): Promise<string> => {
    let captionText = '';
    if (!mediaKeys || mediaKeys.length === 0 || !mediaIncludes) return captionText;

    for (const media of mediaIncludes) {
        if (media.type === 'photo' && media.url) {
            try {
                const { buffer, mimeType } = await downloadImage(media.url);
                const imageCaption = await gemini.analyzeImageCaption(buffer, mimeType);
                if (imageCaption) {
                    captionText += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
                }
            } catch (e) {
                console.error(`Failed to analyze image ${media.url}:`, e);
            }
        }
    }
    return captionText;
};
