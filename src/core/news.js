const firestore = require('../services/firestore');
const gemini = require('../services/gemini');
const xApi = require('../services/xApi');

const fetchYahooNewsHeadlines = async () => {
    try {
        const response = await fetch('https://news.yahoo.co.jp/rss/topics/top-picks.xml');
        const text = await response.text();
        
        // 正規表現で簡易的にRSSからタイトルを抽出（依存関係追加を避けるため）
        const titleRegex = /<title>(.*?)<\/title>/g;
        let match;
        const headlines = [];
        
        while ((match = titleRegex.exec(text)) !== null) {
            const title = match[1];
            // Yahooニュースのタイトルやサイト名などのノイズを除去
            if (title !== 'Yahoo!ニュース・トピックス - 主要' && !title.includes('Yahoo!')) {
                headlines.push(title);
            }
        }
        
        // 最新の5件程度を返す
        return headlines.slice(0, 5);
    } catch (e) {
        console.error("Failed to fetch news", e);
        return [];
    }
};

const runProactiveNewsPostBatch = async () => {
    console.log("Starting Proactive News Post Batch...");
    try {
        const headlines = await fetchYahooNewsHeadlines();
        if (headlines.length === 0) {
            console.log("No headlines fetched, skipping.");
            return { status: 'skipped', reason: 'No headlines' };
        }

        console.log("Fetched headlines:\n", headlines.join('\n'));

        // 生成
        const postText = await gemini.generateNewsPost(headlines);
        if (!postText) {
            console.log("Failed to generate news post.");
            return { status: 'failed', reason: 'Generation failed' };
        }

        console.log("Generated Post:", postText);

        // Xに投稿
        await xApi.tweet(postText);
        
        // 履歴をFirestoreに保存
        await firestore.saveTimelinePost(postText);

        return { status: 'success', post: postText };
    } catch (e) {
        console.error("Error in runProactiveNewsPostBatch:", e);
        throw e;
    }
};

module.exports = {
    runProactiveNewsPostBatch,
    fetchYahooNewsHeadlines
};
