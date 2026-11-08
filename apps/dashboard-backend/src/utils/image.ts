import { PhotonImage, resize, SamplingFilter } from '@silvia-odwyer/photon-node';

/**
 * Allowed raster image MIME types mapped to their canonical file extensions.
 *
 * Security Invariant:
 * Vector formats such as `image/svg+xml` are intentionally excluded because
 * SVG documents can contain executable `<script>` elements and inline event handlers
 * that cause Stored XSS if served with an `image/svg+xml` Content-Type.
 * Additionally, file extensions are derived exclusively from this verified MIME
 * allowlist rather than untrusted `file.originalname` headers.
 */
export const RASTER_MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Resolves the canonical file extension for a supported raster image MIME type.
 *
 * @param mimeType - Raw MIME type string reported by the multipart upload parser.
 * @returns The canonical lowercase file extension without a leading dot (`png`, `jpg`, `webp`, or `gif`).
 * @throws Error when the MIME type is missing or not in the raster image allowlist.
 */
export function resolveRasterImageExtension(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  const ext = RASTER_MIME_TO_EXTENSION[normalized];
  if (!ext) {
    throw new Error(
      `Only raster image uploads (PNG, JPEG, WebP, GIF) are permitted (received "${mimeType}").`,
    );
  }
  return ext;
}

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
      resized = resize(img, targetWidth, targetHeight, SamplingFilter.Triangle);
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

/**
 * Strips all metadata (EXIF, GPS, camera model, author, editing software history)
 * from an image buffer by decoding into raw RGBA pixels and re-encoding with Photon WebAssembly.
 *
 * Automatically manages WASM memory allocation by calling .free().
 *
 * @param buffer - Original raw image buffer (PNG, JPEG, WebP, etc.)
 * @param mimeType - Optional MIME type or format hint ('image/png', 'image/jpeg', 'image/webp')
 * @returns Clean image Buffer containing pure pixel data without metadata chunks
 */
export const stripImageMetadata = async (
  buffer: Buffer,
  mimeType = 'image/png'
): Promise<Buffer> => {
  let img: PhotonImage | null = null;
  try {
    img = PhotonImage.new_from_byteslice(new Uint8Array(buffer));
    const normalizedMime = mimeType.toLowerCase();

    if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
      const bytes = img.get_bytes_jpeg(95);
      return Buffer.from(bytes);
    }
    if (normalizedMime === 'image/webp') {
      const bytes = img.get_bytes_webp();
      return Buffer.from(bytes);
    }
    // Default to lossless PNG
    const bytes = img.get_bytes();
    return Buffer.from(bytes);
  } finally {
    if (img) {
      img.free();
    }
  }
};
