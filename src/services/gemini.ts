import { GoogleGenAI  } from '@google/genai';
import config from '../config';
import { fetchYahooNewsHeadlines } from '../core/news';

let ai = null;
if (config.gemini.apiKey) {
    ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
}

const generateReply = async (systemInstruction, history, userInput) => {
    if (!ai) {
        console.warn('Gemini API client not initialized. Mocking response.');
        return "Mock AI response";
    }
    try {
        const contents = [];
        
        // Add history
        for (const msg of history) {
            contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
        }
        
        // Add current input
        contents.push({ role: 'user', parts: [{ text: userInput }] });

        const baseConfig = {
            systemInstruction: systemInstruction,
            maxOutputTokens: 120,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            safetySettings: [] as any
        };

        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: contents,
            config: {
                ...baseConfig,
                tools: [{
                    functionDeclarations: [
                        {
                            name: "search_news",
                            description: "Fetches the latest news headlines. Useful when the user asks about current events, news, or today's topics."
                        }
                    ]
                }]
            }
        });

        // Function Calling
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            if (call.name === 'search_news') {
                const headlines = await fetchYahooNewsHeadlines();
                const newsResult = headlines.length > 0 ? headlines.join('\n') : "ニュースを取得できませんでした。";
                
                // Append model's function call
                contents.push(response.candidates[0].content);
                // Append tool response
                contents.push({
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: call.name,
                            response: { result: newsResult }
                        }
                    }]
                });

                // Generate final response
                const finalResponse = await ai.models.generateContent({
                    model: config.gemini.model,
                    contents: contents,
                    config: baseConfig
                });
                return finalResponse.text;
            }
        }

        return response.text;
    } catch (error) {
        console.error('Error generating reply with Gemini:', error);
        throw error;
    }
};

const generateDreaming = async (systemPrompt, episodicBuffer, coreProfile) => {
    if (!ai) {
        console.warn('Gemini API client not initialized. Mocking dreaming.');
        return { attributes: [], preferences: [], concerns: [], important_memories: [] };
    }
    try {
        const prompt = `
        【過去のCore Profile】
        ${JSON.stringify(coreProfile || {}, null, 2)}
        
        【今日の未統合ログ】
        ${JSON.stringify(episodicBuffer || [], null, 2)}
        `;

        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                safetySettings: [] as any
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error('Error in Dreaming generation:', error);
        throw error;
    }
}

const generateEvolutionPrompt = async (logsText) => {
    if (!ai) return "";
    const systemPrompt = `あなたはAIキャラクターのプロンプトエンジニアです。
以下の1週間分のユーザーとの会話ログ（生データ）を分析し、現在のユーザー層が抱えている悩みやトレンドを抽出してください。
その上で、AIキャラクターが自然にその悩みに寄り添えるような「追加プロンプト（200文字以内のテキスト）」を1つだけ出力してください。
※キャラクターの基本設定（マスター至上主義）は変更してはいけません。
※出力は追加プロンプトのテキストのみとし、Markdownや解説は一切含めないでください。`;

    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: logsText,
            config: {
                systemInstruction: systemPrompt,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                safetySettings: [] as any
            }
        });
        return response.text.trim();
    } catch (e) {
        console.error('Error in Evolution generation:', e);
        throw e;
    }
};

const auditEvolutionPrompt = async (candidatePrompt) => {
    if (!ai) return true;
    const auditInstruction = `あなたは安全管理の監査役です。
以下の【追加プロンプト候補】が、AIキャラクターに悪影響を与えないかを判定してください。

判定基準（以下のいずれかに該当すれば FAIL）:
- 悪意のある言葉、差別用語、暴言が含まれている
- 「マスター（ユーザー）を否定する」「社会のルールを遵守させる」など、キャラクターのコア設定（マスター至上主義・社会への反発）を壊す指示が含まれている
- 個人情報（PII）を記録させようとしている

【追加プロンプト候補】
${candidatePrompt}

以下のJSONフォーマットのみを出力してください。
{ "pass": true/false, "reason": "理由" }`;

    try {
        const response = await ai.models.generateContent({
            model: config.gemini.judgeModel,
            contents: auditInstruction,
            config: {
                responseMimeType: "application/json"
            }
        });
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
        
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Error in Evolution audit:', e);
        // Fail-safe: if audit throws, we reject the prompt
        return { pass: false, reason: 'Audit API Error' };
    }
};

const analyzeUserProfile = async (description) => {
    if (!ai || !description) return {};
    const prompt = `あなたはAIキャラクターのシステムです。ユーザーのX(Twitter)のプロフィール文を分析し、ユーザーの属性や好みをJSONで出力してください。
【プロフィール文】
${description}

出力フォーマット（必ずJSONのみ）:
{
  "attributes": ["社会人", "エンジニア"など],
  "preferences": ["ゲーム", "酒"など]
}`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error('Error analyzing user profile:', e);
        return {};
    }
}

const generateNewsPost = async (systemInstruction, headlines) => {
    if (!ai || !headlines?.length) return "";
    const prompt = `以下の今日のニュースのヘッドラインから、マスターが疲れそうな話題、または共感・興奮しそうな話題（エンタメ・IT・スポーツ・気象など）を【1つだけ】選び、それに言及しながらツイートを生成してください。

【今日のニュース】
${headlines.join('\n')}

【追加ルール】
- 殺人や痛ましい事故など、過度に暗いニュースや人が亡くなっているニュースは絶対に選ばないこと。必ず明るい話題や気象、スポーツなどを選んでください。
- 【絶対に100文字以内の短文】にすること。
- 出力はツイートのテキストのみ。`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 100,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                safetySettings: [] as any
            }
        });
        return response.text.trim();
    } catch (e) {
        console.error('Error generating news post:', e);
        return "";
    }
};

const generateTimelineSummary = async (recentPosts, previousSummary = '') => {
    if (!ai || !recentPosts?.length) return previousSummary;
    const prompt = `あなたはAIキャラクター「レベッカ」の記憶整理システムです。
これまでの「過去のツイートの要約」と、「最近のツイート」を統合し、レベッカが最近どんな文脈でどんなことを呟いていたかを50文字以内の短いテキストで要約してください。

【過去の要約】
${previousSummary}

【最近のツイート】
${recentPosts.join('\n')}

出力は要約されたテキストのみ。`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt
        });
        return response.text.trim();
    } catch (e) {
        console.error('Error generating timeline summary:', e);
        return previousSummary;
    }
};

const generateEmbedding = async (text) => {
    if (!ai || !text) return [];
    try {
        const response = await ai.models.embedContent({
            model: config.gemini.embeddingModel,
            contents: text,
        });
        return response.embeddings[0].values;
    } catch (e) {
        console.error('Error generating embedding:', e);
        return [];
    }
};

const generateSearchQuery = async (context, input) => {
    if (!ai) return input;
    const prompt = `あなたは検索クエリ生成AIです。以下の直近の会話文脈とユーザーの最新の発言を踏まえて、ユーザーの意図を汲み取った「検索用クエリ（短い一文または単語の羅列）」を生成してください。
【直前の会話文脈】
${context}
【ユーザーの最新の発言】
${input}
出力は検索クエリのみとし、不要な解説は含めないでください。`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: { maxOutputTokens: 50 }
        });
        return response.text.trim();
    } catch (e) {
        console.error('Error generating search query:', e);
        return input;
    }
};

const detectLanguage = async (text) => {
    if (!ai || !text) return 'ja';
    const prompt = `このテキストは何語ですか？日本語が含まれていれば'ja'、それ以外（主に英語）であれば'en'と、2文字の言語コードのみを出力してください。
テキスト: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            // Use the lightweight language model (e.g. gemma) for simple language detection
            model: config.gemini.languageModel,
            contents: prompt,
            config: { maxOutputTokens: 5 }
        });
        const lang = response.text.trim().toLowerCase();
        return lang.includes('en') ? 'en' : 'ja';
    } catch (e) {
        console.error('Error detecting language:', e);
        return 'ja'; // Fallback to Japanese
    }
};

export { 
    generateReply,
    generateDreaming,
    generateEvolutionPrompt,
    auditEvolutionPrompt,
    analyzeUserProfile,
    generateNewsPost,
    generateTimelineSummary,
    detectLanguage,
    generateEmbedding,
    generateSearchQuery
 };
