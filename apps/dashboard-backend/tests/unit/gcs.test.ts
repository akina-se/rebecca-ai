import { parseGcsUrlResult, parseGcsUrl, isGcsUrl, extractGcsObjectPath } from '../../src/utils/gcs';
import { logger } from '../../src/utils/logger';

describe('GCS URL Utility with Result Pattern', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseGcsUrlResult', () => {
    it('should return success with parsed components for canonical path-style GCS HTTPS URLs', () => {
      const result = parseGcsUrlResult('https://storage.googleapis.com/my-bucket/media_assets/banner.png');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'media_assets/banner.png'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return success with parsed components for canonical path-style GCS HTTP URLs', () => {
      const result = parseGcsUrlResult('http://storage.googleapis.com/my-bucket/images/avatar.jpg');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'images/avatar.jpg'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return success with parsed components for Cloud Console viewer URLs', () => {
      const result = parseGcsUrlResult('https://storage.cloud.google.com/my-bucket/campaigns/c1/photo.webp');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'campaigns/c1/photo.webp'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return success for virtual-hosted-style (subdomain) GCS URLs without corrupting object path', () => {
      const result = parseGcsUrlResult('https://my-bucket.storage.googleapis.com/media_assets/nested/item.png');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'media_assets/nested/item.png'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return success for GS URI schemes', () => {
      const result = parseGcsUrlResult('gs://my-bucket/media_assets/photo.jpg');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'media_assets/photo.jpg'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should handle URLs with query parameters and fragments properly', () => {
      const result = parseGcsUrlResult('https://storage.googleapis.com/my-bucket/files/doc.pdf?alt=media&token=123#page=2');
      expect(result).toEqual({
        success: true,
        bucket: 'my-bucket',
        objectPath: 'files/doc.pdf'
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return NOT_GCS_URL for non-GCS HTTP URLs without emitting warnings', () => {
      const r1 = parseGcsUrlResult('https://example.com/my-bucket/image.png');
      expect(r1).toEqual({ success: false, reason: 'NOT_GCS_URL' });

      const r2 = parseGcsUrlResult('https://evil-storage.googleapis.com/my-bucket/image.png');
      expect(r2).toEqual({ success: false, reason: 'NOT_GCS_URL' });

      const r3 = parseGcsUrlResult('https://storage.googleapis.com.attacker.com/my-bucket/image.png');
      expect(r3).toEqual({ success: false, reason: 'NOT_GCS_URL' });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return NOT_GCS_URL for non-string, empty, or non-HTTP inputs without emitting warnings', () => {
      expect(parseGcsUrlResult(null)).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult(undefined)).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult(123)).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult('')).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult('   ')).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult('not-a-valid-url')).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(parseGcsUrlResult('ftp://storage.googleapis.com/bucket/file.png')).toEqual({ success: false, reason: 'NOT_GCS_URL' });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return MALFORMED_GCS_URL and log warnings for malformed GCS path-style URLs', () => {
      const r1 = parseGcsUrlResult('https://storage.googleapis.com');
      expect(r1.success).toBe(false);
      if (!r1.success) {
        expect(r1.reason).toBe('MALFORMED_GCS_URL');
      }

      const r2 = parseGcsUrlResult('https://storage.googleapis.com/');
      expect(r2.success).toBe(false);
      if (!r2.success) {
        expect(r2.reason).toBe('MALFORMED_GCS_URL');
      }

      const r3 = parseGcsUrlResult('https://storage.googleapis.com/bucket-only');
      expect(r3.success).toBe(false);
      if (!r3.success) {
        expect(r3.reason).toBe('MALFORMED_GCS_URL');
      }

      const r4 = parseGcsUrlResult('https://storage.googleapis.com/bucket-only/');
      expect(r4.success).toBe(false);
      if (!r4.success) {
        expect(r4.reason).toBe('MALFORMED_GCS_URL');
      }

      expect(logger.warn).toHaveBeenCalledTimes(4);
    });

    it('should return MALFORMED_GCS_URL and log warnings for malformed virtual-hosted GCS URLs', () => {
      const r1 = parseGcsUrlResult('https://my-bucket.storage.googleapis.com');
      expect(r1.success).toBe(false);
      if (!r1.success) {
        expect(r1.reason).toBe('MALFORMED_GCS_URL');
      }

      const r2 = parseGcsUrlResult('https://my-bucket.storage.googleapis.com/');
      expect(r2.success).toBe(false);
      if (!r2.success) {
        expect(r2.reason).toBe('MALFORMED_GCS_URL');
      }

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should return MALFORMED_GCS_URL and log warnings for malformed gs:// URIs', () => {
      const r1 = parseGcsUrlResult('gs://');
      expect(r1.success).toBe(false);
      if (!r1.success) {
        expect(r1.reason).toBe('MALFORMED_GCS_URL');
      }

      const r2 = parseGcsUrlResult('gs://my-bucket');
      expect(r2.success).toBe(false);
      if (!r2.success) {
        expect(r2.reason).toBe('MALFORMED_GCS_URL');
      }

      const r3 = parseGcsUrlResult('gs://my-bucket/');
      expect(r3.success).toBe(false);
      if (!r3.success) {
        expect(r3.reason).toBe('MALFORMED_GCS_URL');
      }

      expect(logger.warn).toHaveBeenCalledTimes(3);
    });
  });

  describe('parseGcsUrl helper', () => {
    it('should return ParsedGcsUrl for valid inputs', () => {
      const parsed = parseGcsUrl('gs://bucket/path/to/asset.png');
      expect(parsed).toEqual({
        bucket: 'bucket',
        objectPath: 'path/to/asset.png'
      });
    });

    it('should return null for non-GCS or malformed inputs', () => {
      expect(parseGcsUrl('https://example.com/asset.png')).toBeNull();
      expect(parseGcsUrl('gs://bucket')).toBeNull();
    });
  });

  describe('isGcsUrl helper', () => {
    it('should return true for valid GCS URLs and URIs', () => {
      expect(isGcsUrl('gs://bucket/file.png')).toBe(true);
      expect(isGcsUrl('https://storage.googleapis.com/bucket/file.png')).toBe(true);
      expect(isGcsUrl('https://bucket.storage.googleapis.com/file.png')).toBe(true);
      expect(isGcsUrl('https://storage.cloud.google.com/bucket/file.png')).toBe(true);
    });

    it('should return true for malformed GCS references to ensure internal routing', () => {
      expect(isGcsUrl('https://storage.googleapis.com/broken')).toBe(true);
      expect(isGcsUrl('gs://broken')).toBe(true);
    });

    it('should return false for external or non-GCS URLs', () => {
      expect(isGcsUrl('https://example.com/image.png')).toBe(false);
      expect(isGcsUrl('https://pbs.twimg.com/media/xyz.jpg')).toBe(false);
      expect(isGcsUrl('')).toBe(false);
      expect(isGcsUrl(null)).toBe(false);
    });
  });

  describe('extractGcsObjectPath helper', () => {
    it('should extract correct object path for all supported GCS formats', () => {
      expect(extractGcsObjectPath('gs://bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://storage.googleapis.com/bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://bucket.storage.googleapis.com/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://storage.cloud.google.com/bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
    });

    it('should return null for non-GCS URLs or invalid values', () => {
      expect(extractGcsObjectPath('https://example.com/asset.png')).toBeNull();
      expect(extractGcsObjectPath('gs://bucket')).toBeNull();
      expect(extractGcsObjectPath(undefined)).toBeNull();
    });
  });
});
