import { PhotonImage, resize, SamplingFilter } from '@silvia-odwyer/photon-node';

/**
 * Resizes an image buffer to a maximum width (maintaining aspect ratio without enlargement)
 * and converts the output to WebP format using WebAssembly (Photon).
 *
 * Automatically manages WASM memory allocation by invoking .free() on intermediate objects.
 *
 * @param buffer - Raw image binary buffer (PNG, JPEG, WebP, etc.)
 * @param maxWidth - Maximum width constraint (default 400px)
 * @returns Compressed WebP Buffer
 */
export const generateWebpThumbnail = async (
  buffer: Buffer,
  maxWidth = 400
): Promise<Buffer> => {
  let img: PhotonImage | null = null;
  let resized: PhotonImage | null = null;

  try {
    img = PhotonImage.new_from_byteslice(new Uint8Array(buffer));
    const width = img.get_width();
    const height = img.get_height();

    if (width > maxWidth && width > 0) {
      const targetWidth = maxWidth;
      const targetHeight = Math.max(1, Math.round((height * targetWidth) / width));
      resized = resize(img, targetWidth, targetHeight, SamplingFilter.Lanczos3);
      const webpBytes = resized.get_bytes_webp();
      return Buffer.from(webpBytes);
    }

    const webpBytes = img.get_bytes_webp();
    return Buffer.from(webpBytes);
  } finally {
    if (img) {
      img.free();
    }
    if (resized) {
      resized.free();
    }
  }
};
