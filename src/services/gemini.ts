import { GoogleGenAI, Content } from '@google/genai';
import config from '../config';
import { fetchYahooNewsHeadlines } from '../utils/newsFetcher';
import { ConversationLogEntry, UserCoreProfile } from '../types';

/**
 * Gemini API client instance.
 */
let ai: GoogleGenAI | null = null;
if (config.gemini.apiKey) {
    ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
}

/**
 * Generates a reply using the Gemini AI model based on system instructions and conversation history.
 * 
 * @param systemInstruction - The system persona and instruction prompt.
 * @param history - Array of previous conversation log entries.
 * @param userInput - The latest input from the user.
 * @returns A promise that resolves to the generated reply string.
 */
const generateReply = async (systemInstruction: string, history: ConversationLogEntry[], userInput: string): Promise<string> => {
    if (!ai) {
        console.warn('Gemini API client not initialized. Mocking response.');
        return "Mock AI response";
    }
    try {
        const contents: Content[] = [];
        
        for (const msg of history) {
            contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
        }
        
        contents.push({ role: 'user', parts: [{ text: userInput }] });

        const baseConfig = {
            systemInstruction: systemInstruction,
            maxOutputTokens: 120,
            safetySettings: [] as never[]
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

        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            if (call.name === 'search_news') {
                const headlines = await fetchYahooNewsHeadlines();
                const newsResult = headlines.length > 0 ? headlines.join('\n') : "ニュースを取得できませんでした。";
                
                if (response.candidates && response.candidates[0].content) {
                    contents.push(response.candidates[0].content);
                }
                
                contents.push({
                    role: 'user',
                    parts: [{
                        functionResponse: {
                            name: call.name,
                            response: { result: newsResult }
                        }
                    }]
                });

                const finalResponse = await ai.models.generateContent({
                    model: config.gemini.model,
                    contents: contents,
                    config: baseConfig
                });
                return finalResponse.text;
            }
        }

        return response.text || '';
    } catch (error) {
        console.error('Error generating reply with Gemini:', error);
        throw error;
    }
};

/**
 * Generates an updated core profile based on the previous profile and daily conversational buffers.
 * 
 * @param systemPrompt - The system instruction defining the dreaming protocol.
 * @param episodicBuffer - Recent conversation logs not yet integrated.
 * @param coreProfile - The user's current core profile.
 * @returns A promise that resolves to the updated core profile.
 */
const generateDreaming = async (systemPrompt: string, episodicBuffer: ConversationLogEntry[], coreProfile: UserCoreProfile): Promise<UserCoreProfile> => {
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
                safetySettings: [] as never[]
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error('Error in Dreaming generation:', error);
        throw error;
    }
}

/**
 * Analyzes conversation logs to extract user trends and issues, outputting an evolution prompt for the AI persona.
 * 
 * @param logsText - Raw conversation logs spanning a specific period.
 * @returns A promise that resolves to the newly generated evolution prompt text.
 */
const generateEvolutionPrompt = async (logsText: string): Promise<string> => {
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
                safetySettings: [] as never[]
            }
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error in Evolution generation:', e);
        throw e;
    }
};

/**
 * Audits a generated evolution prompt to ensure it adheres to safety and persona guidelines.
 * 
 * @param candidatePrompt - The candidate prompt to evaluate.
 * @returns A promise resolving to the audit result, indicating pass/fail status and an optional reason.
 */
const auditEvolutionPrompt = async (candidatePrompt: string): Promise<{ pass: boolean, reason?: string }> => {
    if (!ai) return { pass: true };
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
        let jsonStr = response.text?.trim() || "{}";
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');
        
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Error in Evolution audit:', e);
        return { pass: false, reason: 'Audit API Error' };
    }
};

/**
 * Analyzes a user's social media profile description to extract attributes and preferences.
 * 
 * @param description - The user's profile biography or description.
 * @returns A promise that resolves to an object containing extracted attributes and preferences.
 */
const analyzeUserProfile = async (description: string): Promise<Record<string, unknown>> => {
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
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error('Error analyzing user profile:', e);
        return {};
    }
}

/**
 * Generates a short, engaging post based on current news headlines and system persona rules.
 * 
 * @param systemInstruction - The system persona instruction.
 * @param headlines - Array of recent news headlines.
 * @returns A promise resolving to the generated post text.
 */
const generateNewsPost = async (systemInstruction: string, headlines: string[]): Promise<string> => {
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
                safetySettings: [] as never[]
            }
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error generating news post:', e);
        return "";
    }
};

/**
 * Summarizes the latest timeline events and integrates them with a previous summary context.
 * 
 * @param recentPosts - Array of recently authored posts or events.
 * @param previousSummary - The existing historical summary to append and condense.
 * @returns A promise resolving to the updated timeline summary string.
 */
const generateTimelineSummary = async (recentPosts: string[], previousSummary = ''): Promise<string> => {
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
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error generating timeline summary:', e);
        return previousSummary;
    }
};

/**
 * Computes a vector embedding for the provided text.
 * 
 * @param text - The text to process.
 * @returns A promise resolving to an array of numbers representing the embedding vector.
 */
const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!ai || !text) return [];
    try {
        const response = await ai.models.embedContent({
            model: config.gemini.embeddingModel,
            contents: text,
            config: {
                outputDimensionality: 768
            }
        });
        return response.embeddings[0].values;
    } catch (e) {
        console.error('Error generating embedding:', e);
        return [];
    }
};

/**
 * Extracts a concise search query based on conversational context and the newest user input.
 * 
 * @param context - Previous conversation context text.
 * @param input - The latest input provided by the user.
 * @returns A promise resolving to a refined search query string.
 */
const generateSearchQuery = async (context: string, input: string): Promise<string> => {
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
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error generating search query:', e);
        return input;
    }
};

/**
 * Detects whether the provided text is predominantly Japanese or English.
 * 
 * @param text - The text to evaluate.
 * @returns A promise resolving to the language code ('ja' or 'en').
 */
const detectLanguage = async (text: string): Promise<'ja' | 'en'> => {
    if (!ai || !text) return 'ja';
    const prompt = `このテキストは何語ですか？日本語が含まれていれば'ja'、それ以外（主に英語）であれば'en'と、2文字の言語コードのみを出力してください。
テキスト: "${text}"`;
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.languageModel,
            contents: prompt,
            config: { maxOutputTokens: 5 }
        });
        const lang = response.text?.trim().toLowerCase() || 'ja';
        return lang.includes('en') ? 'en' : 'ja';
    } catch (e) {
        console.error('Error detecting language:', e);
        return 'ja';
    }
};

/**
 * Analyzes an image buffer and generates a detailed descriptive caption in Japanese.
 * 
 * @param imageBuffer - The image data buffer to process.
 * @param mimeType - The MIME type of the image.
 * @returns A promise resolving to a generated descriptive caption.
 */
const analyzeImageCaption = async (imageBuffer: Buffer, mimeType: string): Promise<string> => {
    if (!ai) return "";
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.visionModel,
            contents: [
                {
                    inlineData: {
                        data: imageBuffer.toString("base64"),
                        mimeType: mimeType
                    }
                },
                `この画像に写っている状況、被写体の表情、および感情を説明するテキスト（キャプション）を生成してください。ベクトル検索のクエリとして使用するため、具体的なキーワード（場所、服の色、表情、シチュエーション）を豊富に含めた自然な日本語にしてください。途中で途切れないように、必ず完全な文章（句点で終わる）で出力してください。`
            ],
            config: {
                maxOutputTokens: 500
            }
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error("Error analyzing image caption:", e);
        return "";
    }
};

/**
 * Infers an image search query based on a tweet's intent and context.
 * 
 * @param tweetText - The text of the tweet being composed.
 * @param timelineSummary - The user's recent timeline context and events.
 * @returns A promise resolving to a search query string or null if an image is deemed unnecessary.
 */
const inferImageSearchQuery = async (tweetText: string, timelineSummary: string): Promise<string | null> => {
    if (!ai) return null;
    try {
        const prompt = `あなたはAIキャラクター「レベッカ」の心情を分析するAIです。
以下のレベッカがたった今投稿しようとしているツイート文と、直近のタイムライン要約から、レベッカの現在の感情や状況を推測し、画像検索のための「検索クエリ（短い一文または単語の羅列）」を出力してください。
画像が不要だと思われる内容（事務連絡や抽象的すぎる内容）の場合は、"null" という文字列だけを出力してください。

【直近のタイムライン要約】
${timelineSummary}

【今回のツイート内容】
${tweetText}

出力は検索クエリのテキストのみとし、不要な解説やMarkdown表記は含めないでください。`;

        const response = await ai.models.generateContent({
            model: config.gemini.imageInferenceModel,
            contents: prompt,
            config: {
                maxOutputTokens: 100
            }
        });
        const result = response.text?.trim() || null;
        return result === 'null' ? null : result;
    } catch (e) {
        console.error("Error inferring image search query:", e);
        return null;
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
    generateSearchQuery,
    analyzeImageCaption,
    inferImageSearchQuery
 };
