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
 * Generates a short, engaging post based on current news headlines and system persona rules.
 * 
 * @param systemInstruction - The system persona instruction.
 * @param prompt - The formatted instruction with the headlines.
 * @returns A promise resolving to the generated post text.
 */
const generateNewsPost = async (systemInstruction: string, prompt: string): Promise<string> => {
    if (!ai || !prompt) return "";
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
 * @param prompt - The formatted instruction containing recent posts and previous summary.
 * @returns A promise resolving to the updated timeline summary string.
 */
const generateTimelineSummary = async (prompt: string): Promise<string> => {
    if (!ai || !prompt) return "";
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error generating timeline summary:', e);
        return "";
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
 * @param prompt - The formatted instructions, context, and input.
 * @returns A promise resolving to a refined search query string.
 */
const generateSearchQuery = async (prompt: string): Promise<string> => {
    if (!ai) return "";
    try {
        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: { maxOutputTokens: 50 }
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.error('Error generating search query:', e);
        return "";
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
