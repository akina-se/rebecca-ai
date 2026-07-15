import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as firestore from '../src/services/firestore';
import { analyzeImageCaption, generateEmbedding } from '../src/services/gemini';
import * as storage from '../src/services/storage';

const IMAGES_DIR = path.join(process.cwd(), '../../images');

const getMimeType = (ext: string) => {
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

        // Analyze caption
        console.log(` -> Analyzing caption with Gemini Vision...`);
        let caption = "";
        let retries = 3;
        while (retries > 0) {
            try {
                caption = await analyzeImageCaption(buffer, mimeType);
                if (caption) break;
            } catch (e) {
                console.error(` -> Error analyzing caption (Retries left: ${retries - 1}):`, e.message || e);
            }
            retries--;
            if (retries > 0) {
                console.log(" -> Waiting 5 seconds before retrying...");
                await sleep(5000);
            }
        }

        if (!caption) {
            console.error(" -> Error: Caption could not be generated after retries. Skipping Firestore save.");
            continue;
        }
        console.log(` -> Caption: ${caption}`);

        // Generate embedding
        console.log(` -> Generating text embedding...`);
        const embedding = await generateEmbedding(caption);

        if (!embedding || embedding.length === 0) {
            console.warn(` -> Failed to generate embedding for ${file}. Skipping.`);
            continue;
        }

        // Save to Firestore
        console.log(` -> Saving metadata to Firestore...`);
        await firestore.saveImageMetadata(hash, gsUri, caption, embedding);
        console.log(` -> Success!`);

        // Delay to avoid hitting RPM limits (15 RPM -> 4s, 5 RPM -> 12s)
        console.log(` -> Waiting 10 seconds before processing the next image to respect rate limits...`);
        await sleep(10000);
    }

    console.log("\nBulk upload process completed.");
};

run().catch(console.error);
