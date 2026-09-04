/**
 * @fileoverview Gemini API service wrapper.
 * Provides functions for generating conversational replies, analyzing user profiles,
 * and performing various semantic NLP tasks using Google's generative AI models.
 */

import { GoogleGenAI, Content } from '@google/genai';
import config from '../config';
import { fetchYahooNewsHeadlines } from '../utils/newsFetcher';
import { ConversationLogEntry, UserCoreProfile } from '../types';
import { parsePersonaResponse, StructuredPersonaResponse, PERSONA_RESPONSE_SCHEMA } from '@rebecca/persona';

/**
 * Global Gemini API client instance.
 * Initialized if a valid API key is present in the configuration.
 */
let ai: GoogleGenAI | null = null;
if (config.gemini.apiKey) {
    ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
}

/**
 * Generates a conversational reply using the Gemini AI model.
 * 
 * Incorporates system persona instructions, historical conversation context, and the latest user input.
 * Includes support for tool calling, specifically fetching news headlines if requested by the model.
 * 
 * @param systemInstruction - The system persona and behavioral guidelines.
 * @param history - A chronological sequence of previous conversation log entries.
 * @param userInput - The most recent text input provided by the user.
 * @returns A promise that resolves to the generated AI response string.
 * @throws {Error} If the underlying Gemini API call fails.
 */
const generateReply = async (systemInstruction: string, history: ConversationLogEntry[], userInput: string): Promise<string> => {
    if (!ai) {
        throw new Error('Gemini API client not initialized');
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
                const finalText = finalResponse.text?.trim();
                if (!finalText) {
                    throw new Error('Gemini API returned empty response after function execution.');
                }
                return finalText;
            }
        }

        const replyText = response.text?.trim();
        if (!replyText) {
            throw new Error('Gemini API returned empty response or content was filtered.');
        }
        return replyText;
    } catch (error) {
        console.error('Error generating reply with Gemini:', error);
        throw error;
    }
};

/**
 * Generates an updated core profile by assimilating recent episodic memories.
 * 
 * @param systemPrompt - The system instruction defining the profiling and dreaming protocol.
 * @param episodicBuffer - A collection of recent conversation logs not yet integrated into the profile.
 * @param coreProfile - The user's existing core profile data.
 * @returns A promise that resolves to the newly synthesized core profile.
 * @throws {Error} If generation or JSON parsing fails.
 */
const generateDreaming = async (systemPrompt: string, episodicBuffer: ConversationLogEntry[], coreProfile: UserCoreProfile): Promise<UserCoreProfile> => {
    if (!ai) {
        throw new Error('Gemini API client not initialized');
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
 * @param prompt - The formatted prompt containing the logs and instructions.
 * @returns A promise that resolves to the newly generated evolution prompt text.
 */
const generateEvolutionPrompt = async (prompt: string): Promise<string> => {
    if (!ai) return "";

    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: {
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
 * @param auditInstruction - The audit rules and prompt structure.
 * @returns A promise resolving to the audit result, indicating pass/fail status and an optional reason.
 */
const auditEvolutionPrompt = async (candidatePrompt: string, auditInstruction: string): Promise<{ pass: boolean, reason?: string }> => {
    if (!ai) return { pass: true };

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
 * @param prompt - The formatted prompt including instructions and the description.
 * @returns A promise that resolves to an object containing extracted attributes and preferences.
 */
const analyzeUserProfile = async (prompt: string): Promise<Record<string, unknown>> => {
    if (!ai || !prompt) return {};
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
 * Internal helper to generate structured persona post (thought + reply) via Gemini.
 */
const generateStructuredPostInternal = async (
    systemInstruction: string,
    prompt: string | string[],
    maxOutputTokens = 180
): Promise<StructuredPersonaResponse> => {
    if (!ai || !prompt || (Array.isArray(prompt) && prompt.length === 0)) {
        return { thought: '', reply: '' };
    }
    try {
        const contentStr = Array.isArray(prompt) ? prompt.join('\n') : prompt;
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: contentStr,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: maxOutputTokens,
                responseMimeType: 'application/json',
                responseSchema: PERSONA_RESPONSE_SCHEMA,
                safetySettings: [] as never[]
            }
        });
        return parsePersonaResponse(response.text?.trim() || '');
    } catch (e) {
        console.error('Error generating structured timeline post:', e);
        return { thought: '', reply: '' };
    }
};

/**
 * Generates a structured news post (inner thought and public tweet text) based on news headlines.
 */
const generateStructuredNewsPost = async (
    systemInstruction: string,
    prompt: string | string[]
): Promise<StructuredPersonaResponse> => {
    return generateStructuredPostInternal(systemInstruction, prompt, 180);
};

/**
 * Generates a structured soliloquy post (inner thought and public tweet text) based on situational context.
 */
const generateStructuredSoliloquyPost = async (
    systemInstruction: string,
    prompt: string | string[]
): Promise<StructuredPersonaResponse> => {
    return generateStructuredPostInternal(systemInstruction, prompt, 180);
};

/**
 * Summarizes the latest timeline events and integrates them with a previous summary context.
 * 
 * @param prompt - The formatted instruction containing recent posts and previous summary.
 * @returns A promise resolving to the updated timeline summary string.
 */
const generateTimelineSummary = async (prompt: string | string[], previousSummary?: string): Promise<string> => {
    if (!ai || !prompt || (Array.isArray(prompt) && prompt.length === 0)) return previousSummary || "";
    try {
        const contentStr = Array.isArray(prompt) ? prompt.join('\n') : prompt;
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: contentStr,
            config: {
                systemInstruction: 'あなたはAIキャラクター「レベッカ」の長期記憶管理システムです。与えられたレベッカ自身の投稿履歴と過去の要約を元に、最近どのようなニュース、技術、社会トレンドや日常のトピックについて言及していたかを客観的に400文字以内で要約してください。言及されたトピックの内容や関心の推移を中心に記述し、語尾や過剰な感情表現の模倣ではなく、対話や思考の知的背景となる文脈を自然な日本語の文章で整理してください（箇条書きや記号は使用しないでください）。',
                maxOutputTokens: 400
            }
        });
        return response.text?.trim() || previousSummary || "";
    } catch (e) {
        console.error('Error generating timeline summary:', e);
        return previousSummary || "";
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
        const values = response.embeddings?.[0]?.values;
        return values || [];
    } catch (e) {
        console.error('Error generating embedding:', e);
        return [];
    }
};

/**
 * Extracts a concise search query based on conversational context and the newest user input.
 * 
 * @param contextOrPrompt - The conversational context or formatted prompt.
 * @param userInput - The user input.
 * @returns A promise resolving to a refined search query string.
 */
const generateSearchQuery = async (contextOrPrompt: string, userInput?: string): Promise<string> => {
    if (!ai) return userInput || contextOrPrompt || "";
    try {
        const prompt = userInput ? `Context: ${contextOrPrompt}\nUser: ${userInput}` : contextOrPrompt;
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: { maxOutputTokens: 50 }
        });
        return response.text?.trim() || userInput || "";
    } catch (e) {
        console.error('Error generating search query:', e);
        return userInput || "";
    }
};

/**
 * Detects whether the provided text is predominantly Japanese or English.
 * 
 * @param prompt - The formatted instruction and text.
 * @returns A promise resolving to the language code ('ja' or 'en').
 */
const detectLanguage = async (prompt: string): Promise<'ja' | 'en'> => {
    if (!ai || !prompt) return 'ja';
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.languageModel,
            contents: prompt,
            config: { maxOutputTokens: 300 }
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
 * @param prompt - The instruction prompt.
 * @returns A promise resolving to a generated descriptive caption.
 */
const analyzeImageCaption = async (imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string> => {
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
                prompt
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
 * @param prompt - The formatted prompt containing rules and context.
 * @returns A promise resolving to a search query string or null if an image is deemed unnecessary.
 */
const inferImageSearchQuery = async (prompt: string): Promise<string | null> => {
    if (!ai) return null;
    try {
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

/**
 * Verifies whether a candidate image is contextually relevant to the generated post text (LLM Re-ranking).
 *
 * @param imageCaption - The description/caption of the image candidate.
 * @param postText - The generated post text to be published.
 * @returns A promise resolving to true if contextually aligned, false otherwise.
 */
const verifyImageRelevance = async (imageCaption: string, postText: string): Promise<boolean> => {
    if (!ai || !imageCaption || !postText) return false;
    try {
        const prompt = `あなたはSNS投稿と添付画像の文脈整合性を判定する厳格なモデレーターAIです。
以下の「投稿テキスト」と「画像キャプション」を比較し、この投稿にこの画像を添付することが文脈上自然かつ適切かどうかを判定してください。
無関係な画像（例: ニュースの内容と全く関係のない日常風景、料理、キャラ画像など）は絶対に除外（false）してください。

【投稿テキスト】
${postText}

【画像キャプション】
${imageCaption}

出力はJSON形式で、以下のスキーマに従ってください：
{
  "relevant": true または false,
  "reason": "判定理由（短文）"
}`;

        const response = await ai.models.generateContent({
            model: config.gemini.judgeModel || config.gemini.model,
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text?.trim() || "{}";
        const cleaned = text.startsWith('```') ? text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '') : text;
        const parsed = JSON.parse(cleaned);
        return Boolean(parsed.relevant);
    } catch (e) {
        console.error("Error verifying image relevance:", e);
        return false;
    }
};

/**
 * Generates a structured conversational reply with internal monologue using Gemini API Structured Outputs.
 *
 * @param systemInstruction - The system persona and behavioral guidelines.
 * @param history - Conversation history log entries.
 * @param userInput - The most recent text input provided by the user.
 * @returns A promise resolving to StructuredPersonaResponse ({ thought, reply }).
 */
const generateStructuredReply = async (
    systemInstruction: string,
    history: ConversationLogEntry[],
    userInput: string
): Promise<StructuredPersonaResponse> => {
    if (!ai) {
        throw new Error('Gemini API client not initialized');
    }

    try {
        const contents: Content[] = [];
        for (const msg of history) {
            if (msg.role === 'model') {
                const modelText = msg.thought
                    ? `【思考・本音】${msg.thought}\n【発話】${msg.content}`
                    : msg.content;
                contents.push({ role: 'model', parts: [{ text: modelText }] });
            } else {
                contents.push({ role: 'user', parts: [{ text: msg.content }] });
            }
        }
        contents.push({ role: 'user', parts: [{ text: userInput }] });

        const baseConfig = {
            systemInstruction: systemInstruction,
            maxOutputTokens: 180,
            responseMimeType: 'application/json',
            responseSchema: PERSONA_RESPONSE_SCHEMA,
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
                            description: "Fetches the latest news headlines. ONLY use when the user explicitly asks about current events, news, or today's topics. NEVER use for casual greetings or general chat."
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
                const finalText = finalResponse.text?.trim();
                if (!finalText) {
                    throw new Error('Gemini API returned empty structured response after function execution.');
                }
                return parsePersonaResponse(finalText);
            }
        }

        const rawText = response.text?.trim();
        if (!rawText) {
            throw new Error('Gemini API returned empty structured response or content was filtered.');
        }
        return parsePersonaResponse(rawText);
    } catch (error) {
        console.error('Error generating structured reply with Gemini:', error);
        throw error;
    }
};

export { 
    generateReply,
    generateStructuredReply,
    verifyImageRelevance,
    generateDreaming,
    generateEvolutionPrompt,
    auditEvolutionPrompt,
    analyzeUserProfile,
    generateStructuredNewsPost,
    generateStructuredSoliloquyPost,
    generateTimelineSummary,
    detectLanguage,
    generateEmbedding,
    generateSearchQuery,
    analyzeImageCaption,
    inferImageSearchQuery
 };
