import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as firestore from '../src/services/firestore';
import * as gemini from '../src/services/gemini';
import * as storage from '../src/services/storage';

const IMAGES_DIR = path.join(process.cwd(), 'images');

const getMimeType = (ext: string) => {
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
};

const run = async () => {
    console.log("Starting bulk image upload process...");

    if (!fs.existsSync(IMAGES_DIR)) {
        console.log(`Creating directory: ${IMAGES_DIR}`);
        fs.mkdirSync(IMAGES_DIR);
        console.log("Directory created. Please place images in the 'images/' folder and run again.");
        return;
    }

    const files = fs.readdirSync(IMAGES_DIR).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });

    if (files.length === 0) {
        console.log("No images found in the 'images/' directory.");
        return;
    }

    console.log(`Found ${files.length} images to process.`);

    for (const file of files) {
        const filePath = path.join(IMAGES_DIR, file);
        const buffer = fs.readFileSync(filePath);
        
        // Compute SHA-256 hash
        const hashSum = crypto.createHash('sha256');
        hashSum.update(buffer);
        const hash = hashSum.digest('hex');

        console.log(`\nProcessing ${file} (Hash: ${hash.substring(0, 8)}...)`);

        // Check if exists
        const existing = await firestore.getImageByHash(hash);
        if (existing) {
            console.log(` -> Skipping: Already exists in Firestore (URL: ${existing.url})`);
            continue;
        }

        // Upload to GCS
        const mimeType = getMimeType(path.extname(file).toLowerCase());
        console.log(` -> Uploading to GCS...`);
        let gsUri;
        try {
            gsUri = await storage.uploadImage(hash, buffer, mimeType);
            console.log(` -> Uploaded to ${gsUri}`);
        } catch (e) {
            console.error(" -> Error uploading to GCS:", e);
            continue;
        }

        // Analyze tags
        console.log(` -> Analyzing tags with Gemini Vision...`);
        let tags = [];
        try {
            tags = await gemini.analyzeImageTags(buffer, mimeType);
            if (tags.length === 0) {
                console.error(" -> Error: Tags could not be generated (empty). Skipping Firestore save.");
                continue;
            }
            console.log(` -> Tags inferred: ${tags.join(', ')}`);
        } catch (e) {
            console.error(" -> Error analyzing tags:", e);
            continue;
        }

        // Save to Firestore
        console.log(` -> Saving metadata to Firestore...`);
        await firestore.saveImageMetadata(hash, gsUri, tags);
        console.log(` -> Done!`);
    }

    console.log("\nBulk upload process completed.");
};

run().catch(console.error);
