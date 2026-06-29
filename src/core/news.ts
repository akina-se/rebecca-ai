import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import * as xApi from '../services/xApi';

const fetchYahooNewsHeadlines = async () => {
    try {
        const categories = ['top-picks', 'domestic', 'entertainment', 'it', 'sports'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const url = `https://news.yahoo.co.jp/rss/topics/${randomCategory}.xml`;
        console.log(`Fetching news from: ${url}`);
        const response = await fetch(url);
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
        let postText = await gemini.generateNewsPost(headlines);
        if (!postText) {
            console.log("Failed to generate news post.");
            return { status: 'failed', reason: 'Generation failed' };
        }

        // タグ付け機能: 文字数に余裕がある場合のみ別口でハッシュタグを付与
        const hashtag = "\n#全肯定AIレベッカ";
        if (postText.length + hashtag.length <= 140) {
            postText += hashtag;
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

export { 
    runProactiveNewsPostBatch,
    fetchYahooNewsHeadlines
 };
