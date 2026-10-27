import { generateWebpThumbnail, stripImageMetadata } from '../../src/utils/image';
import { PhotonImage } from '@silvia-odwyer/photon-node';

describe('Image Utility (Photon WebAssembly)', () => {
  // 1x1 valid PNG base64
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  it('converts an image with width <= maxWidth to WebP without enlarging', async () => {
    // Calling with default maxWidth parameter
    const webpBuffer = await generateWebpThumbnail(validPngBuffer);

    expect(webpBuffer).toBeInstanceOf(Buffer);
    expect(webpBuffer.length).toBeGreaterThan(0);

    // Verify it is a valid WebP image by decoding it back with Photon
    const decoded = PhotonImage.new_from_byteslice(new Uint8Array(webpBuffer));
    expect(decoded.get_width()).toBe(1);
    expect(decoded.get_height()).toBe(1);
    decoded.free();
  });

  it('resizes an image with width > maxWidth down to target maxWidth and converts to WebP', async () => {
    // Construct a synthetic 500x250 PNG image buffer using Photon
    const originalWidth = 500;
    const originalHeight = 250;
    const rawData = new Uint8Array(originalWidth * originalHeight * 4);
    for (let i = 0; i < rawData.length; i += 4) {
      rawData[i] = 100;     // R
      rawData[i + 1] = 150; // G
      rawData[i + 2] = 200; // B
      rawData[i + 3] = 255; // A
    }
    const syntheticImg = new PhotonImage(rawData, originalWidth, originalHeight);
    const pngBytes = syntheticImg.get_bytes();
    syntheticImg.free();

    const resizedBuffer = await generateWebpThumbnail(Buffer.from(pngBytes), 400);

    expect(resizedBuffer).toBeInstanceOf(Buffer);
    expect(resizedBuffer.length).toBeGreaterThan(0);

    const decoded = PhotonImage.new_from_byteslice(new Uint8Array(resizedBuffer));
    expect(decoded.get_width()).toBe(400);
    expect(decoded.get_height()).toBe(200);
    decoded.free();
  });

  it('throws an error when provided with an invalid or corrupt buffer', async () => {
    const corruptBuffer = Buffer.from('corrupt-non-image-binary-data');

    await expect(generateWebpThumbnail(corruptBuffer, 400)).rejects.toThrow();
  });

  describe('stripImageMetadata', () => {
    it('strips metadata and returns valid clean PNG buffer by default', async () => {
      const cleanPng = await stripImageMetadata(validPngBuffer);
      expect(cleanPng).toBeInstanceOf(Buffer);
      expect(cleanPng.length).toBeGreaterThan(0);

      const decoded = PhotonImage.new_from_byteslice(new Uint8Array(cleanPng));
      expect(decoded.get_width()).toBe(1);
      expect(decoded.get_height()).toBe(1);
      decoded.free();
    });

    it('strips metadata and re-encodes to clean JPEG when requested', async () => {
      const cleanJpeg = await stripImageMetadata(validPngBuffer, 'image/jpeg');
      expect(cleanJpeg).toBeInstanceOf(Buffer);
      expect(cleanJpeg.length).toBeGreaterThan(0);

      const decoded = PhotonImage.new_from_byteslice(new Uint8Array(cleanJpeg));
      expect(decoded.get_width()).toBe(1);
      expect(decoded.get_height()).toBe(1);
      decoded.free();
    });

    it('strips metadata and re-encodes to clean WebP when requested', async () => {
      const cleanWebp = await stripImageMetadata(validPngBuffer, 'image/webp');
      expect(cleanWebp).toBeInstanceOf(Buffer);
      expect(cleanWebp.length).toBeGreaterThan(0);

      const decoded = PhotonImage.new_from_byteslice(new Uint8Array(cleanWebp));
      expect(decoded.get_width()).toBe(1);
      expect(decoded.get_height()).toBe(1);
      decoded.free();
    });

    it('throws error when stripping metadata on invalid image buffer', async () => {
      const corrupt = Buffer.from('not-an-image');
      await expect(stripImageMetadata(corrupt)).rejects.toThrow();
    });
  });
});
