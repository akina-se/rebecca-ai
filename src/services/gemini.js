const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

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

        const response = await ai.models.generateContent({
            model: config.gemini.model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 120,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });

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
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
                ]
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
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
                ]
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

module.exports = {
    generateReply,
    generateDreaming,
    generateEvolutionPrompt,
    auditEvolutionPrompt
};
