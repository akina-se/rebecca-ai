require('dotenv').config();
const { runProactiveNewsPostBatch } = require('../src/core/news');
const firestore = require('../src/services/firestore');
const xApi = require('../src/services/xApi');
const gemini = require('../src/services/gemini');

// Mock external APIs for safe local testing
xApi.tweet = async (text) => {
    console.log(`[MOCK TWEET]: ${text}`);
    return { data: { id: 'mock-tweet-id' } };
};

firestore.saveTimelinePost = async (text) => {
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
