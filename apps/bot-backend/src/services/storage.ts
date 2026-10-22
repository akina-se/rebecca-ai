/**
 * @fileoverview Google Cloud Storage service implementation.
 * Manages the uploading and downloading of image assets using Application Default Credentials (ADC).
 */

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
 * Generates a file path based on the provided hash and stores the image with the specified MIME type.
 * 
 * @param hash - A unique SHA-256 hash used as the destination filename.
 * @param buffer - The binary image data to upload.
 * @param mimeType - The MIME type associated with the image data (e.g., 'image/jpeg').
 * @returns A promise resolving to the internal Google Cloud Storage URI (`gs://...`).
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
 * Downloads an image from a private Google Cloud Storage bucket.
 * 
 * @param gsUri - The internal Google Cloud Storage URI of the file to download (`gs://...`).
 * @returns A promise resolving to the downloaded image as a binary buffer.
 */
const downloadImage = async (gsUri: string): Promise<Buffer> => {
    const filePath = gsUri.replace(`gs://${bucketName}/`, '');
    const file = bucket.file(filePath);
    const [buffer] = await file.download();
    return buffer;
};

/**
 * Generates a time-limited signed URL for secure, direct client downloads from private Cloud Storage.
 *
 * @param storagePathOrGsUri - Cloud Storage object path (e.g., 'rewards/illustration.png' or 'gs://bucket/...').
 * @param expiresInMinutes - Duration in minutes for which the signed URL remains valid (defaults to 30).
 * @returns A promise resolving to the HTTPS signed URL.
 */
const generateSignedUrl = async (
    storagePathOrGsUri: string,
    expiresInMinutes = 30
): Promise<string> => {
    const normalizedPath = storagePathOrGsUri.replace(/^gs:\/\/[^/]+\//, '').replace(/^\//, '');
    const file = bucket.file(normalizedPath);
    const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return url;
};

export { uploadImage, downloadImage, generateSignedUrl };
