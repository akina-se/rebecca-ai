/**
 * Fetches recent news headlines from Yahoo News RSS feeds.
 * Randomly selects a category and retrieves up to 5 headlines.
 * 
 * @returns A promise resolving to an array of headline strings.
 */
export const fetchYahooNewsHeadlines = async (): Promise<string[]> => {
    try {
        const categories = ['top-picks', 'domestic', 'entertainment', 'it', 'sports'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const url = `https://news.yahoo.co.jp/rss/topics/${randomCategory}.xml`;
        console.log(`Fetching news from: ${url}`);
        const response = await fetch(url);
        const text = await response.text();
        
        const titleRegex = /<title>(.*?)<\/title>/g;
        let match;
        const headlines = [];
        
        while ((match = titleRegex.exec(text)) !== null) {
            const title = match[1];
            if (title !== 'Yahoo!ニュース・トピックス - 主要' && !title.includes('Yahoo!')) {
                headlines.push(title);
            }
        }
        
        return headlines.slice(0, 5);
    } catch (e) {
        console.error("Failed to fetch news", e);
        return [];
    }
};
