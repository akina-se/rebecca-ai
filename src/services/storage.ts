import { Storage } from '@google-cloud/storage';
import config from '../config';

/**
 * Storage client instance using Application Default Credentials (ADC).
 */
const storage = new Storage();

/**
 * Name of the Google Cloud Storage bucket for images.
 */
const bucketName = config.images.bucketName;

/**
 * Bucket instance for image storage.
 */
const bucket = storage.bucket(bucketName);

/**
 * Uploads an image buffer to Google Cloud Storage privately.
 * 
 * @param hash - SHA-256 hash to use as the filename.
 * @param buffer - Image data buffer.
 * @param mimeType - MIME type of the image.
 * @returns A promise that resolves to the internal gs:// URI of the uploaded file.
 */
const uploadImage = async (hash: string, buffer: Buffer, mimeType: string): Promise<string> => {
    const filePath = `images/${hash}`;
    const file = bucket.file(filePath);
    await file.save(buffer, {
        metadata: { contentType: mimeType }
    });
    return `gs://${bucketName}/${filePath}`;
};

/**
 * Downloads an image from a gs:// URI privately.
 * 
 * @param gsUri - The internal gs:// URI to download from.
 * @returns A promise that resolves to the downloaded image buffer.
 */
const downloadImage = async (gsUri: string): Promise<Buffer> => {
    const filePath = gsUri.replace(`gs://${bucketName}/`, '');
    const file = bucket.file(filePath);
    const [buffer] = await file.download();
    return buffer;
};

export { uploadImage, downloadImage };
