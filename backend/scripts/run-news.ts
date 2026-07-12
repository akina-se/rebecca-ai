import 'dotenv/config';
import { runProactiveNewsPostBatch  } from '../src/core/news';
import * as firestore from '../src/services/firestore';
import * as xApi from '../src/services/xApi';


// Mock external APIs for safe local testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(xApi as any).tweet = async (text: string, mediaIds?: string[]) => {
    console.log(`[MOCK TWEET]: ${text}`);
    if (mediaIds && mediaIds.length > 0) {
        console.log(`[MOCK TWEET MEDIA ATTACHED]: ${mediaIds.join(', ')}`);
    }
    return { data: { id: 'mock-tweet-id' } };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(xApi as any).uploadMedia = async (buffer: Buffer, mimeType: string) => {
    console.log(`[MOCK UPLOAD MEDIA]: Uploading ${mimeType} buffer of size ${buffer.length} bytes`);
    return 'mock-media-id-12345';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(firestore as any).saveTimelinePost = async (text: string) => {
    console.log(`[MOCK DB] Saved timeline post: ${text}`);
};

const run = async () => {
    console.log("=========================================");
    console.log(" 📰 News Post Batch (手動実行テスト)");
    console.log("=========================================");
    
    try {
        const result = await runProactiveNewsPostBatch();
        console.log("\n[結果]:", result);
    } catch (e) {
        console.error("Test failed:", e);
    }
};

run();
