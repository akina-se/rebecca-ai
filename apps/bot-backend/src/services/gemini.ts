/**
 * @fileoverview Gemini API service wrapper.
 * Provides functions for generating conversational replies, analyzing user profiles,
 * and performing various semantic NLP tasks using Google's generative AI models.
 */

import { GoogleGenAI, Content, Type } from '@google/genai';
import { formatZonedDateTime } from '../utils/time';
import { ConversationLogEntry, UserCoreProfile, IGeminiService } from '../types';
import { parsePersonaResponse, StructuredPersonaResponse, PERSONA_RESPONSE_SCHEMA } from '@rebecca/persona';
import { StructuredNewsPostResponse } from '../features/news/types';

/**
 * Creates the JSON schema for structured news post generation with enum-constrained candidate title selection.
 */
const createStructuredNewsPostSchema = (candidateHeadlines: string[]) => ({
  type: 'object',
  properties: {
    selectedTitle: {
      type: 'string',
      enum: candidateHeadlines,
      description: 'The exact headline title chosen from the candidate list.',
    },
    thought: {
      type: 'string',
      description: 'Inner thoughts, true feelings, and emotional shifts based on the persona (within 150 characters).',
    },
    reply: {
      type: 'string',
      description: 'The public tweet text (within 100 characters).',
    },
  },
  required: ['selectedTitle', 'thought', 'reply'],
});

const SEARCH_WEB_TOOL = {
  functionDeclarations: [
    {
      name: 'search_web',
      description: 'Searches the web for up-to-date information, facts, or answers when asked questions or requested to investigate a topic.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'Search keywords or question to look up on the web',
          },
        },
        required: ['query'],
      },
    },
  ],
};

/**
 * Configuration options required by GeminiService.
 */
export interface GeminiServiceConfig {
  apiKey?: string;
  model: string;
  embeddingModel: string;
  judgeModel?: string;
  languageModel?: string;
  visionModel?: string;
  imageInferenceModel?: string;
  newsSearchModel?: string;
  newsPostModel?: string;
  appTimezone?: string;
}

/**
 * Encapsulates interactions with Google Gemini Large Language Models.
 * Implements IGeminiService with explicit constructor injection, eliminating ambient config coupling.
 */
export class GeminiService implements IGeminiService {
  private ai: GoogleGenAI | null = null;

  constructor(
    private readonly config: GeminiServiceConfig,
    client?: GoogleGenAI,
  ) {
    if (client) {
      this.ai = client;
    } else if (config.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    }
  }

  /**
   * Generates an updated core profile by assimilating recent episodic memories.
   *
   * @param systemPrompt - The system instruction defining the profiling and dreaming protocol.
   * @param episodicBuffer - A collection of recent conversation logs not yet integrated into the profile.
   * @param coreProfile - The user's existing core profile data.
   * @returns A promise that resolves to the newly synthesized core profile.
   */
  async generateDreaming(
    systemPrompt: string,
    episodicBuffer: ConversationLogEntry[],
    coreProfile: UserCoreProfile
  ): Promise<UserCoreProfile> {
    if (!this.ai) {
      throw new Error('Gemini API client not initialized');
    }
    try {
      const prompt = `
        【過去のCore Profile】
        ${JSON.stringify(coreProfile || {}, null, 2)}
        
        【今日の未統合ログ】
        ${JSON.stringify(episodicBuffer || [], null, 2)}
        `;

      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          safetySettings: [] as never[],
        },
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
  async generateEvolutionPrompt(prompt: string): Promise<string> {
    if (!this.ai) return '';

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: {
          safetySettings: [] as never[],
        },
      });
      return response.text?.trim() || '';
    } catch (e) {
      console.error('Error in Evolution generation:', e);
      throw e;
    }
  }

  /**
   * Audits a generated evolution prompt to ensure it adheres to safety and persona guidelines.
   *
   * @param candidatePrompt - The candidate prompt to evaluate.
   * @param auditInstruction - The audit rules and prompt structure.
   * @returns A promise resolving to the audit result, indicating pass/fail status and an optional reason.
   */
  async auditEvolutionPrompt(
    candidatePrompt: string,
    auditInstruction: string
  ): Promise<{ pass: boolean; reason?: string }> {
    if (!this.ai) return { pass: true };

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.judgeModel || this.config.model,
        contents: auditInstruction,
        config: {
          responseMimeType: 'application/json',
        },
      });
      let jsonStr = response.text?.trim() || '{}';
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json\n/, '').replace(/\n```$/, '');
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```\n/, '').replace(/\n```$/, '');

      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Error in Evolution audit:', e);
      return { pass: false, reason: 'Audit API Error' };
    }
  }

  /**
   * Analyzes a user's social media profile description to extract attributes and preferences.
   *
   * @param prompt - The formatted prompt including instructions and the description.
   * @returns A promise that resolves to an object containing extracted attributes and preferences.
   */
  async analyzeUserProfile(prompt: string): Promise<UserCoreProfile> {
    if (!this.ai || !prompt) return {} as UserCoreProfile;
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error('Error analyzing user profile:', e);
      return {} as UserCoreProfile;
    }
  }

  /**
   * Internal helper to generate structured persona post (thought + reply) via Gemini.
   */
  private async generateStructuredPostInternal(
    systemInstruction: string,
    prompt: string | string[],
    maxOutputTokens: number = 500,
  ): Promise<StructuredPersonaResponse> {
    if (!this.ai) {
      throw new Error('Gemini API client not initialized');
    }
    if (!prompt || (Array.isArray(prompt) && prompt.length === 0)) {
      throw new Error('Prompt cannot be empty for structured post generation');
    }
    try {
      const contentStr = Array.isArray(prompt) ? prompt.join('\n') : prompt;
      const modelToUse = this.config.model;
      const response = await this.ai.models.generateContent({
        model: modelToUse,
        contents: contentStr,
        config: {
          systemInstruction: systemInstruction,
          maxOutputTokens: maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: PERSONA_RESPONSE_SCHEMA,
          safetySettings: [] as never[],
        },
      });
      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Gemini API returned empty structured response or content was filtered');
      }
      const parsed = parsePersonaResponse(rawText);
      if (!parsed.reply || !parsed.reply.trim()) {
        throw new Error('Gemini API returned structured response with empty reply');
      }
      return parsed;
    } catch (e) {
      console.error('Error generating structured timeline post:', e);
      throw e;
    }
  }

  /**
   * Generates a structured news post (inner thought, public tweet text, and selected headline)
   * based on news headlines and persona instructions, constrained to candidate headlines via enum.
   *
   * @param systemInstruction - System instruction defining character persona and behavior.
   * @param prompt - Contextual prompt containing headlines, timeline summary, and guidelines.
   * @param candidateHeadlines - Array of candidate headline titles to constrain selectedTitle.
   * @returns A promise resolving to the strongly-typed StructuredNewsPostResponse.
   */
  async generateStructuredNewsPost(
    systemInstruction: string,
    prompt: string | string[],
    candidateHeadlines: string[],
  ): Promise<StructuredNewsPostResponse> {
    if (!this.ai) {
      throw new Error('Gemini API client not initialized');
    }
    if (!prompt || (Array.isArray(prompt) && prompt.length === 0)) {
      throw new Error('Prompt cannot be empty for structured news post generation');
    }
    if (!candidateHeadlines || candidateHeadlines.length === 0) {
      throw new Error('Candidate headlines cannot be empty for structured news post generation');
    }

    try {
      const contentStr = Array.isArray(prompt) ? prompt.join('\n') : prompt;
      const modelToUse = this.config.newsPostModel || this.config.model;
      const responseSchema = createStructuredNewsPostSchema(candidateHeadlines);
      const response = await this.ai.models.generateContent({
        model: modelToUse,
        contents: contentStr,
        config: {
          systemInstruction,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
          responseSchema,
          safetySettings: [] as never[],
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Gemini API returned empty response for structured news post');
      }

      const cleaned = rawText.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
      const parsed = JSON.parse(cleaned);

      if (
        typeof parsed.thought !== 'string' ||
        typeof parsed.reply !== 'string' ||
        typeof parsed.selectedTitle !== 'string'
      ) {
        throw new Error('Gemini API returned malformed response schema for structured news post');
      }

      const trimmedReply = parsed.reply.trim();
      if (!trimmedReply) {
        throw new Error('Gemini API returned structured news post with empty reply');
      }

      return {
        selectedTitle: parsed.selectedTitle.trim(),
        thought: parsed.thought.trim(),
        reply: trimmedReply,
      };
    } catch (e) {
      console.error('Error generating structured news post:', e);
      throw e;
    }
  }

  /**
   * Generates a structured timeline post (inner thought and public tweet text) based on situational context.
   */
  async generateStructuredTimelinePost(
    systemInstruction: string,
    prompt: string | string[]
  ): Promise<StructuredPersonaResponse> {
    return this.generateStructuredPostInternal(systemInstruction, prompt, 500);
  }

  /**
   * Summarizes the latest timeline events and integrates them with a previous summary context.
   *
   * @param prompt - The formatted instruction containing recent posts and previous summary.
   * @returns A promise resolving to the updated timeline summary string.
   * @throws Error if client is uninitialized, prompt is invalid, or generation fails.
   */
  async generateTimelineSummary(prompt: string | string[]): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini API client not initialized');
    }
    const contentStr = Array.isArray(prompt) ? prompt.join('\n') : prompt;
    if (!contentStr || contentStr.trim().length === 0) {
      throw new Error('[GeminiService] Prompt for timeline summary cannot be empty.');
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: contentStr,
        config: {
          systemInstruction:
            'あなたはAIキャラクターの長期記憶管理システムです。与えられたキャラクター自身の投稿履歴と過去の要約を元に、最近どのようなニュース、技術、社会トレンドや日常のトピックについて言及していたかを客観的に400文字以内で要約してください。言及されたトピックの内容や関心の推移を中心に記述し、語尾や過剰な感情表現の模倣ではなく、対話や思考の知的背景となる文脈を自然な日本語の文章で整理してください（箇条書きや記号は使用しないでください）。',
          maxOutputTokens: 400,
        },
      });
      const summary = response.text?.trim();
      if (!summary) {
        throw new Error('[GeminiService] Gemini returned empty response for timeline summary.');
      }
      return summary;
    } catch (e) {
      console.error('[GeminiService] Failed to generate timeline summary:', e);
      throw e;
    }
  }

  /**
   * Computes a vector embedding for the provided text.
   *
   * @param text - The text to process.
   * @returns A promise resolving to an array of numbers representing the embedding vector.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.ai || !text) return [];
    try {
      const response = await this.ai.models.embedContent({
        model: this.config.embeddingModel,
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });
      const values = response.embeddings?.[0]?.values;
      return values || [];
    } catch (e) {
      console.error('Error generating embedding:', e);
      return [];
    }
  }

  /**
   * Extracts a concise search query based on conversational context and the newest user input.
   *
   * @param contextOrPrompt - The conversational context or formatted prompt.
   * @param userInput - The user input.
   * @returns A promise resolving to a refined search query string.
   */
  async generateSearchQuery(contextOrPrompt: string, userInput?: string): Promise<string> {
    if (!this.ai) return userInput || contextOrPrompt || '';
    try {
      const prompt = userInput ? `Context: ${contextOrPrompt}\nUser: ${userInput}` : contextOrPrompt;
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: { maxOutputTokens: 50 },
      });
      return response.text?.trim() || userInput || '';
    } catch (e) {
      console.error('Error generating search query:', e);
      return userInput || '';
    }
  }

  /**
   * Detects whether the provided text is predominantly Japanese or English.
   *
   * @param prompt - The formatted instruction and text.
   * @returns A promise resolving to the language code ('ja' or 'en').
   */
  async detectLanguage(prompt: string): Promise<'ja' | 'en'> {
    if (!this.ai || !prompt) return 'ja';
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.languageModel || this.config.model,
        contents: prompt,
        config: { maxOutputTokens: 300 },
      });
      const lang = response.text?.trim().toLowerCase() || 'ja';
      return lang.includes('en') ? 'en' : 'ja';
    } catch (e) {
      console.error('Error detecting language:', e);
      return 'ja';
    }
  }

  /**
   * Analyzes an image buffer and generates a detailed descriptive caption in Japanese.
   *
   * @param imageBuffer - The image data buffer to process.
   * @param mimeType - The MIME type of the image.
   * @param prompt - The instruction prompt.
   * @returns A promise resolving to a generated descriptive caption.
   */
  async analyzeImageCaption(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string = 'この画像に写っているキャラクターの服装、ポーズ、表情、背景、シチュエーションを日本語で詳細に説明してください。'
  ): Promise<string> {
    if (!this.ai) return '';
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.visionModel || this.config.model,
        contents: [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType,
            },
          },
          prompt,
        ],
        config: {
          maxOutputTokens: 500,
        },
      });
      return response.text?.trim() || '';
    } catch (e) {
      console.error('Error analyzing image caption:', e);
      return '';
    }
  }

  /**
   * Infers an image search query based on a tweet's intent and context.
   *
   * @param prompt - The formatted prompt containing rules and context.
   * @returns A promise resolving to a search query string or null if an image is deemed unnecessary.
   */
  async inferImageSearchQuery(prompt: string): Promise<string | null> {
    if (!this.ai) return null;
    try {
      const response = await this.ai.models.generateContent({
        model: this.config.imageInferenceModel || this.config.model,
        contents: prompt,
        config: {
          maxOutputTokens: 100,
        },
      });
      const result = response.text?.trim() || null;
      return result === 'null' ? null : result;
    } catch (e) {
      console.error('Error inferring image search query:', e);
      return null;
    }
  }

  /**
   * Verifies whether a candidate image is contextually relevant to the generated post text (LLM Re-ranking).
   *
   * @param imageCaption - The description/caption of the image candidate.
   * @param postText - The generated post text to be published.
   * @returns A promise resolving to true if contextually aligned, false otherwise.
   */
  async verifyImageRelevance(imageCaption: string, postText: string): Promise<boolean> {
    if (!this.ai || !imageCaption || !postText) return false;
    try {
      const prompt = `あなたはAIキャラクターのSNS投稿と添付画像の文脈調和を判定するモデレーターAIです。
画像データベースには「キャラクター自身が様々な衣装・シチュエーションで描かれたイラスト」が登録されています。
以下の「投稿テキスト」に対し、「画像」がキャラクター自身の投稿行動や発言の背景情景として自然に調和しているかを判定してください。

【判定方針】
1. 合格（relevant: true）とする基準:
   - 投稿で語られている中心的な行動・体験・シチュエーション（趣味、イベント、作業、日常の過ごし方等）と、画像に描かれた活動・環境・感情が自然に結びついていること。
   - 細部の属性（特定の競技名や道具の種類など）が完全に同一でなくとも、投稿全体の主旨や感情のトーン（応援、演奏、くつろぎ、配信など）として自然なリアクション・活動風景として成立していれば許容します。

2. 厳格に不合格（relevant: false）とする基準:
   - 投稿の主旨や活動と、画像の状況・アクティビティが明らかに乖離または矛盾していること。
   - 投稿の感情や場面（真剣な話題、静かな日常など）に対して、画像の衣装やシチュエーション（過度な戦闘装備、場違いなリゾート等）が突飛で不自然なこと。
   - 投稿内容に一切関係のない無関係な単独ポーズやシチュエーション。

※「キャラクターが写っていれば何でもよい」という安易な判定は避け、投稿の話題と画像のアクティビティ・場面設定の整合性を厳密に評価してください。

【投稿テキスト】
${postText}

【画像キャプション】
${imageCaption}

出力はJSON形式で、以下のスキーマに従ってください：
{
  "relevant": true または false,
  "reason": "判定理由（短文）"
}`;

      const response = await this.ai.models.generateContent({
        model: this.config.judgeModel || this.config.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '{}';
      const cleaned = text.startsWith('```') ? text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '') : text;
      const parsed = JSON.parse(cleaned);
      return Boolean(parsed.relevant);
    } catch (e) {
      console.error('Error verifying image relevance:', e);
      return false;
    }
  }

  /**
   * Executes Google Search Grounding for an arbitrary user query.
   *
   * @param query - Search keywords or question to look up.
   * @returns Grounded search summary or fallback message.
   */
  async executeWebSearch(query: string): Promise<string> {
    if (!this.ai) return '検索クライアントが未初期化です。';
    const trimmed = query.trim();
    if (!trimmed) return '検索クエリが空です。';
    try {
      const res = await this.ai.models.generateContent({
        model: this.config.model,
        contents: [{ role: 'user', parts: [{ text: trimmed }] }],
        config: {
          tools: [{ googleSearch: {} }],
          safetySettings: [] as never[],
        },
      });
      return res.text?.trim() || '該当する検索結果が見つかりませんでした。';
    } catch (err) {
      console.warn(`[executeWebSearch] Failed to search for query "${trimmed}":`, (err as Error).message);
      return '一時的なネットワークまたは検索エラーにより情報を取得できませんでした。';
    }
  }

  /**
   * Generates a structured conversational reply with internal monologue using Gemini API Structured Outputs.
   *
   * @param systemInstruction - The system persona and behavioral guidelines.
   * @param history - Conversation history log entries.
   * @param userInput - The most recent text input provided by the user.
   * @returns A promise resolving to StructuredPersonaResponse ({ thought, reply }).
   */
  async generateStructuredReply(
    systemInstruction: string,
    history: ConversationLogEntry[],
    userInput: string
  ): Promise<StructuredPersonaResponse> {
    if (!this.ai) {
      throw new Error('Gemini API client not initialized');
    }

    try {
      const contents: Content[] = [];
      for (const msg of history) {
        const timePrefix = msg.timestamp ? `[${formatZonedDateTime(msg.timestamp, this.config.appTimezone)}] ` : '';
        if (msg.role === 'model') {
          const modelBody = msg.thought
            ? `【思考・本音】${msg.thought}\n【発話】${msg.content}`
            : msg.content;
          contents.push({ role: 'model', parts: [{ text: `${timePrefix}${modelBody}` }] });
        } else {
          contents.push({ role: 'user', parts: [{ text: `${timePrefix}${msg.content}` }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: userInput }] });

      const baseConfig = {
        systemInstruction: systemInstruction,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
        responseSchema: PERSONA_RESPONSE_SCHEMA,
        safetySettings: [] as never[],
      };

      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: contents,
        config: {
          ...baseConfig,
          tools: [SEARCH_WEB_TOOL],
        },
      });

      const functionCall = response.functionCalls?.[0];
      if (!functionCall || functionCall.name !== 'search_web') {
        const rawText = response.text?.trim();
        if (!rawText) {
          throw new Error('Gemini API returned empty structured response or content was filtered.');
        }
        const parsed = parsePersonaResponse(rawText);
        if (!parsed.reply || !parsed.reply.trim()) {
          throw new Error('Gemini API returned structured response with empty reply.');
        }
        return parsed;
      }

      const searchQuery = typeof functionCall.args?.query === 'string' ? functionCall.args.query.trim() : '';
      const searchResult = searchQuery
        ? await this.executeWebSearch(searchQuery)
        : '検索クエリが指定されていません。';

      if (response.candidates?.[0]?.content) {
        contents.push(response.candidates[0].content);
      }

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: { result: searchResult },
            },
          },
        ],
      });

      const finalResponse = await this.ai.models.generateContent({
        model: this.config.model,
        contents: contents,
        config: baseConfig,
      });

      const finalText = finalResponse.text?.trim();
      if (!finalText) {
        throw new Error('Gemini API returned empty structured response after function execution.');
      }
      const parsed = parsePersonaResponse(finalText);
      if (!parsed.reply || !parsed.reply.trim()) {
        throw new Error('Gemini API returned structured response with empty reply after function execution.');
      }
      return parsed;
    } catch (error) {
      console.error('Error generating structured reply with Gemini:', error);
      throw error;
    }
  }
}
