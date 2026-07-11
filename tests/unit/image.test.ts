import { downloadImage } from '../../src/utils/image';

describe('Image Utils', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should download image successfully with correct mime type', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
            headers: new Headers({ 'content-type': 'image/png' })
        });

        const result = await downloadImage('http://example.com/image.png');
        expect(result.mimeType).toBe('image/png');
        expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should fallback to image/jpeg if no content-type header', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
            headers: new Headers()
        });

        const result = await downloadImage('http://example.com/image.jpg');
        expect(result.mimeType).toBe('image/jpeg');
    });

    it('should throw error if response is not ok', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            statusText: 'Not Found'
        });

        await expect(downloadImage('http://example.com/image.jpg')).rejects.toThrow('Failed to download image from http://example.com/image.jpg: Not Found');
    });
});
