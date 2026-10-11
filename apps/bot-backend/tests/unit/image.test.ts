import { downloadImage, isAllowedDomain } from '../../src/utils/image';

describe('Image Utils', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('isAllowedDomain', () => {
        const allowedDomains = ['twimg.com', 'twitter.com', 'x.com', 'example.com'];

        it('should return true for exact domain match', () => {
            expect(isAllowedDomain('x.com', allowedDomains)).toBe(true);
            expect(isAllowedDomain('twimg.com', allowedDomains)).toBe(true);
        });

        it('should return true for subdomains of allowed domains', () => {
            expect(isAllowedDomain('pbs.twimg.com', allowedDomains)).toBe(true);
            expect(isAllowedDomain('ton.twitter.com', allowedDomains)).toBe(true);
            expect(isAllowedDomain('media.x.com', allowedDomains)).toBe(true);
            expect(isAllowedDomain('sub.example.com', allowedDomains)).toBe(true);
        });

        it('should return false for deceptive domain prefixes or lookalike domains', () => {
            expect(isAllowedDomain('fake-twimg.com', allowedDomains)).toBe(false);
            expect(isAllowedDomain('notx.com', allowedDomains)).toBe(false);
            expect(isAllowedDomain('malicious-twimg.com', allowedDomains)).toBe(false);
            expect(isAllowedDomain('169.254.169.254', allowedDomains)).toBe(false);
        });

        it('should handle case insensitivity correctly', () => {
            expect(isAllowedDomain('PBS.TWIMG.COM', allowedDomains)).toBe(true);
            expect(isAllowedDomain('Media.X.Com', allowedDomains)).toBe(true);
        });
    });

    describe('downloadImage', () => {
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

        it('should reject image download from disallowed hosts when allowedDomains is specified', async () => {
            await expect(downloadImage('http://malicious-host.internal/secret.jpg', ['example.com'])).rejects.toThrow('Disallowed image host');
        });

        it('should reject image download with path traversal', async () => {
            await expect(downloadImage('http://example.com/../etc/passwd')).rejects.toThrow('Path traversal detected');
        });

        it('should reject invalid protocol', async () => {
            await expect(downloadImage('ftp://example.com/image.jpg')).rejects.toThrow('Invalid protocol');
        });
    });
});
