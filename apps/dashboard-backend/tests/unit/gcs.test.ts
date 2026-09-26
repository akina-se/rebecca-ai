import { parseGcsUrl, isGcsUrl, extractGcsObjectPath } from '../../src/utils/gcs';

describe('GCS URL Utility', () => {
  describe('parseGcsUrl', () => {
    it('should parse canonical path-style GCS HTTPS URLs', () => {
      const result = parseGcsUrl('https://storage.googleapis.com/my-bucket/media_assets/banner.png');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'media_assets/banner.png'
      });
    });

    it('should parse canonical path-style GCS HTTP URLs', () => {
      const result = parseGcsUrl('http://storage.googleapis.com/my-bucket/images/avatar.jpg');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'images/avatar.jpg'
      });
    });

    it('should parse Google Cloud Console viewer URLs', () => {
      const result = parseGcsUrl('https://storage.cloud.google.com/my-bucket/campaigns/c1/photo.webp');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'campaigns/c1/photo.webp'
      });
    });

    it('should parse virtual-hosted-style (subdomain) GCS URLs without corrupting object path', () => {
      const result = parseGcsUrl('https://my-bucket.storage.googleapis.com/media_assets/nested/item.png');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'media_assets/nested/item.png'
      });
    });

    it('should parse GS URI schemes', () => {
      const result = parseGcsUrl('gs://my-bucket/media_assets/photo.jpg');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'media_assets/photo.jpg'
      });
    });

    it('should handle URLs with query parameters and fragments properly', () => {
      const result = parseGcsUrl('https://storage.googleapis.com/my-bucket/files/doc.pdf?alt=media&token=123#page=2');
      expect(result).toEqual({
        bucket: 'my-bucket',
        objectPath: 'files/doc.pdf'
      });
    });

    it('should return null for non-GCS HTTP URLs', () => {
      expect(parseGcsUrl('https://example.com/my-bucket/image.png')).toBeNull();
      expect(parseGcsUrl('https://evil-storage.googleapis.com/my-bucket/image.png')).toBeNull();
      expect(parseGcsUrl('https://storage.googleapis.com.attacker.com/my-bucket/image.png')).toBeNull();
    });

    it('should return null for URLs missing object paths', () => {
      expect(parseGcsUrl('https://storage.googleapis.com')).toBeNull();
      expect(parseGcsUrl('https://storage.googleapis.com/')).toBeNull();
      expect(parseGcsUrl('https://storage.googleapis.com/bucket-only')).toBeNull();
      expect(parseGcsUrl('https://storage.googleapis.com/bucket-only/')).toBeNull();
      expect(parseGcsUrl('https://my-bucket.storage.googleapis.com')).toBeNull();
      expect(parseGcsUrl('https://my-bucket.storage.googleapis.com/')).toBeNull();
      expect(parseGcsUrl('gs://my-bucket')).toBeNull();
      expect(parseGcsUrl('gs://my-bucket/')).toBeNull();
    });

    it('should return null for non-string, empty, or malformed inputs', () => {
      expect(parseGcsUrl(null)).toBeNull();
      expect(parseGcsUrl(undefined)).toBeNull();
      expect(parseGcsUrl(123)).toBeNull();
      expect(parseGcsUrl('')).toBeNull();
      expect(parseGcsUrl('   ')).toBeNull();
      expect(parseGcsUrl('not-a-valid-url')).toBeNull();
      expect(parseGcsUrl('ftp://storage.googleapis.com/bucket/file.png')).toBeNull();
    });
  });

  describe('isGcsUrl', () => {
    it('should return true for valid GCS URLs and URIs', () => {
      expect(isGcsUrl('gs://bucket/file.png')).toBe(true);
      expect(isGcsUrl('https://storage.googleapis.com/bucket/file.png')).toBe(true);
      expect(isGcsUrl('https://bucket.storage.googleapis.com/file.png')).toBe(true);
      expect(isGcsUrl('https://storage.cloud.google.com/bucket/file.png')).toBe(true);
    });

    it('should return false for invalid or external URLs', () => {
      expect(isGcsUrl('https://example.com/image.png')).toBe(false);
      expect(isGcsUrl('https://pbs.twimg.com/media/xyz.jpg')).toBe(false);
      expect(isGcsUrl('')).toBe(false);
      expect(isGcsUrl(null)).toBe(false);
    });
  });

  describe('extractGcsObjectPath', () => {
    it('should extract correct object path for all supported GCS formats', () => {
      expect(extractGcsObjectPath('gs://bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://storage.googleapis.com/bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://bucket.storage.googleapis.com/nested/dir/asset.png')).toBe('nested/dir/asset.png');
      expect(extractGcsObjectPath('https://storage.cloud.google.com/bucket/nested/dir/asset.png')).toBe('nested/dir/asset.png');
    });

    it('should return null for non-GCS URLs or invalid values', () => {
      expect(extractGcsObjectPath('https://example.com/asset.png')).toBeNull();
      expect(extractGcsObjectPath(undefined)).toBeNull();
    });
  });
});
