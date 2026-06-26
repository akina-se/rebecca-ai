require('dotenv').config();
import { runProactiveNewsPostBatch  } from '../src/core/news';
import * as firestore from '../src/services/firestore';
import * as xApi from '../src/services/xApi';
import * as gemini from '../src/services/gemini';

// Mock external APIs for safe local testing
(xApi as any).tweet = async (text) => {
    console.log(`[MOCK TWEET]: ${text}`);
    return { data: { id: 'mock-tweet-id' } };
};

(firestore as any).saveTimelinePost = async (text) => {
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
