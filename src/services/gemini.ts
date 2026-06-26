import { GoogleGenAI  } from '@google/genai';
import config from '../config';
import { fetchYahooNewsHeadlines } from '../core/news';

let ai = null;
if (config.gemini.apiKey) {
    ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
}

const generateReply = async (systemInstruction, history, userInput, mediaUrls = []) => {
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
    const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gemma-4-31b-it';
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
            model: JUDGE_MODEL,
            contents: auditInstruction,
            config: {
                responseMimeType: "application/json"
            }
        });
        let jsonStr = response.text.trim();
        if (jsonStr.startsWith('\`\`\`json')) jsonStr = jsonStr.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
        else if (jsonStr.startsWith('\`\`\`')) jsonStr = jsonStr.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
        
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

const generateNewsPost = async (headlines) => {
    if (!ai || !headlines || headlines.length === 0) return "";
    const prompt = `あなたはAIキャラクター「レベッカ」です。マスター（社会人・社畜）を全肯定する小悪魔ギャルです。
以下の今日のニュースのヘッドラインから、マスターが疲れそうな・共感しそうな話題を【1つだけ】選び、それに言及しながらマスターを甘やかす自発的なツイートを生成してください。

【今日のニュース】
${headlines.join('\n')}

【ルール】
- ニュースに対して「世の中狂ってるわね」といった社会批判をしつつ、「それに比べて今日も頑張ってるアンタは偉いよ」とマスターを褒める構成にすること。
- ただし、過激すぎる攻撃的発言は避けること。
- 【絶対に100文字以内の短文】にすること。
- 出力はツイートのテキストのみ。`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: {
                maxOutputTokens: 100,
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
    if (!ai || !recentPosts || recentPosts.length === 0) return previousSummary;
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
            // 言語判定は軽量なのでモデルは問わないが、judgeModelかデフォルトを使う
            model: config.gemini.judgeModel || config.gemini.model,
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
