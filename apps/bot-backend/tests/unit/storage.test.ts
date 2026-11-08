import { Storage } from '@google-cloud/storage';

jest.mock('../../src/config', () => ({
    __esModule: true,
    default: {
        images: {
            bucketName: 'rebecca-ai-gal-images'
        }
    }
}));

jest.mock('@google-cloud/storage');

describe('storage.ts', () => {
    let mockFile: any;
    let mockBucket: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockFile = {
            save: jest.fn().mockResolvedValue(undefined),
            download: jest.fn().mockResolvedValue([Buffer.from('test')]),
        };

        mockBucket = {
            file: jest.fn().mockReturnValue(mockFile),
        };

        (Storage as unknown as jest.Mock).mockImplementation(() => ({
            bucket: jest.fn().mockReturnValue(mockBucket),
        }));
    });

    const getStorageModule = () => {
        let module: any;
        jest.isolateModules(() => {
            module = require('../../src/services/storage');
        });
        return module;
    };

    describe('uploadImage', () => {
        it('should upload image and return public URI', async () => {
            const storageService = getStorageModule();
            const result = await storageService.uploadImage('hash123', Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('gs://rebecca-ai-gal-images/images/hash123');
            expect(mockFile.save).toHaveBeenCalled();
        });

        it('should throw error if upload fails', async () => {
            const storageService = getStorageModule();
            mockFile.save.mockRejectedValue(new Error('upload failed'));
            await expect(storageService.uploadImage('hash123', Buffer.from('test'), 'image/jpeg'))
                .rejects.toThrow('upload failed');
        });
    });

    describe('downloadImage', () => {
        it('should download image and return buffer', async () => {
            const storageService = getStorageModule();
            const buffer = await storageService.downloadImage('hash123');
            expect(buffer.toString()).toBe('test');
            expect(mockFile.download).toHaveBeenCalled();
        });

        it('should throw error if download fails', async () => {
            const storageService = getStorageModule();
            mockFile.download.mockRejectedValue(new Error('download failed'));
            await expect(storageService.downloadImage('hash123'))
                .rejects.toThrow('download failed');
        });

        it('should reject gs:// URIs from foreign buckets or with path traversal', async () => {
            const storageService = getStorageModule();
            await expect(storageService.downloadImage('gs://attacker-bucket/secret.png'))
                .rejects.toThrow('Disallowed storage bucket');
            await expect(storageService.downloadImage('gs://rebecca-ai-gal-images/../secret.png'))
                .rejects.toThrow('Path traversal detected');
        });
    });

    describe('generateSignedUrl', () => {
        it('should generate signed url with normalized path from gsUri', async () => {
            const storageService = getStorageModule();
            mockFile.getSignedUrl = jest.fn().mockResolvedValue(['https://signed.url/image.png']);
            const url = await storageService.generateSignedUrl('gs://rebecca-ai-gal-images/rewards/card.png', 15);
            expect(url).toBe('https://signed.url/image.png');
            expect(mockBucket.file).toHaveBeenCalledWith('rewards/card.png');
            expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
                expect.objectContaining({
                    version: 'v4',
                    action: 'read',
                })
            );
        });

        it('should generate signed url with plain relative path', async () => {
            const storageService = getStorageModule();
            mockFile.getSignedUrl = jest.fn().mockResolvedValue(['https://signed.url/image.png']);
            const url = await storageService.generateSignedUrl('/rewards/card.png');
            expect(url).toBe('https://signed.url/image.png');
            expect(mockBucket.file).toHaveBeenCalledWith('rewards/card.png');
        });

        it('should throw fail-fast error when getSignedUrl fails instead of returning unsigned URL', async () => {
            const storageService = getStorageModule();
            mockFile.getSignedUrl = jest.fn().mockRejectedValue(new Error('IAM signBlob denied'));
            await expect(storageService.generateSignedUrl('rewards/card.png'))
                .rejects.toThrow('Failed to generate signed URL for rewards/card.png');
        });
    });
});
