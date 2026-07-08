import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
});
const storage = new Storage();
const bucketName = process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images';

const run = async () => {
    console.log("Starting cleanup of images data...");

    if (!bucketName) {
        console.error("No IMAGE_BUCKET_NAME provided in .env");
        return;
    }

    try {
        // 1. Get all documents from the images collection
        const snapshot = await firestore.collection('images').get();
        if (snapshot.empty) {
            console.log("No documents found in the Firestore 'images' collection.");
        } else {
            console.log(`Found ${snapshot.size} documents in Firestore. Deleting...`);
            const batch = firestore.batch();
            for (const doc of snapshot.docs) {
                batch.delete(doc.ref);
            }
            await batch.commit();
            console.log("Deleted all documents from Firestore 'images' collection.");
        }

        // 2. Delete all files in the bucket under the images/ prefix
        const bucket = storage.bucket(bucketName);
        const [files] = await bucket.getFiles({ prefix: 'images/' });
        
        if (files.length === 0) {
            console.log("No files found in GCS bucket under 'images/'.");
        } else {
            console.log(`Found ${files.length} files in GCS bucket. Deleting...`);
            for (const file of files) {
                await file.delete();
            }
            console.log("Deleted all files from GCS bucket 'images/' prefix.");
        }

        console.log("Cleanup completed successfully!");
    } catch (e) {
        console.error("Error during cleanup:", e);
    }
};

run();
