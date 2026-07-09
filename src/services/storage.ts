import { Storage } from '@google-cloud/storage';
import config from '../config';

// The Storage client will use Application Default Credentials (ADC) implicitly.
const storage = new Storage();
const bucketName = config.images.bucketName;
const bucket = storage.bucket(bucketName);

/**
 * Uploads an image buffer to GCS privately.
 * @param hash SHA-256 hash to use as the filename
 * @param buffer Image data
 * @param mimeType MIME type of the image
 * @returns The internal gs:// URI of the uploaded file
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
 * @param gsUri The internal gs:// URI to download from
 * @returns The image buffer
 */
const downloadImage = async (gsUri: string): Promise<Buffer> => {
    const filePath = gsUri.replace(`gs://${bucketName}/`, '');
    const file = bucket.file(filePath);
    const [buffer] = await file.download();
    return buffer;
};

export { uploadImage, downloadImage };
