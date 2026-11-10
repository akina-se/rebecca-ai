import { CopilotAction, CopilotAttachment, CopilotRequest, CopilotResponse } from '@rebecca/types';
import { Content, GoogleGenAI, Schema, Type } from '@google/genai';
import { config } from '../../config';
import { getActivePersona } from '@rebecca/persona';
import { TimelineRepository } from '../timeline/repository';
import { UsersRepository } from '../users/repository';
import { AssetsRepository } from '../assets/repository';
import { SystemMemoryRepository } from '../system-memory/repository';
import { SupportersRepository } from '../supporters/repository';
import { CopilotToolRegistry } from './toolRegistry';
import { CopilotToolContext } from './types';
import { logger } from '../../utils/logger';

const MAX_REACT_ITERATIONS = 3;

/**
 * Enterprise-grade UseCase for the Admin Copilot feature.
 * Coordinates Rebecca persona prompts, autonomous Gemini function-calling ReAct loops,
 * and safety-gated Human-In-The-Loop (HITL) administrative action proposals.
 */
export class CopilotUseCase {
  private ai?: GoogleGenAI;
  readonly toolRegistry: CopilotToolRegistry;

  constructor(
    private readonly timelineRepo?: TimelineRepository,
    private readonly usersRepo?: UsersRepository,
    private readonly assetsRepo?: AssetsRepository,
    private readonly memoryRepo?: SystemMemoryRepository,
    private readonly supportersRepo?: SupportersRepository,
    toolRegistry?: CopilotToolRegistry,
    aiClient?: GoogleGenAI
  ) {
    this.toolRegistry = toolRegistry ?? new CopilotToolRegistry();
    if (aiClient) {
      this.ai = aiClient;
    } else if (config.gemini.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    }
  }

  /**
   * Processes an admin chat interaction with autonomous multi-turn tool execution.
   *
   * @param request - The chat request containing message, UI context, and conversation history.
   * @returns Structured CopilotResponse with reply, visual attachments, actions, and suggestion chips.
   */
  async processChat(request: CopilotRequest): Promise<CopilotResponse> {
    const userMessage = (request.message ?? '').trim();
    if (!userMessage) {
      throw new Error('User message is required and cannot be empty');
    }

    const currentContext = request.currentContext ?? 'Global Dashboard';
    const rawHistory = request.history ?? [];
    const isEn = request.language === 'en';

    const toolContext: CopilotToolContext = {
      timelineRepo: this.timelineRepo,
      usersRepo: this.usersRepo,
      assetsRepo: this.assetsRepo,
      memoryRepo: this.memoryRepo,
      supportersRepo: this.supportersRepo,
      geminiApiKey: config.gemini.apiKey,
      geminiModel: config.gemini.model,
      isEn
    };

    if (this.ai && config.gemini.apiKey) {
      try {
        return await this.executeReActLoop(userMessage, currentContext, rawHistory, toolContext, isEn);
      } catch (err) {
        logger.error('Gemini autonomous agent loop failed in Copilot', err);
        return {
          reply: isEn
            ? 'A communication error occurred with the AI service (timeout or temporary outage). Please wait a moment and try again.'
            : 'AIモデル（Gemini）との通信中にエラーが発生しました（一時的な障害またはタイムアウト）。お手数ですが、しばらく待ってから再度お試しください。',
          actionRequired: null,
          suggestionChips: isEn
            ? ['Retry', 'Refresh page', 'Check system status']
            : ['もう一度試す', 'ページを再読み込み', 'システム状況を確認']
        };
      }
    }

    // In-character fallback when Gemini API is not configured or in offline test mode
    return this.generateAutonomousFallbackResponse(userMessage, currentContext, toolContext, isEn);
  }

  /**
   * Runs the autonomous ReAct (Reason + Act) tool execution loop with Gemini.
   */
  private async executeReActLoop(
    userMessage: string,
    currentContext: string,
    rawHistory: { role: 'user' | 'model'; text: string }[],
    toolContext: CopilotToolContext,
    isEn: boolean
  ): Promise<CopilotResponse> {
    if (!this.ai) {
      throw new Error('GoogleGenAI client is not initialized');
    }

    const activePersona = getActivePersona(config.persona.activeId);
    const personaBase = activePersona.getBasePrompt('copilot', isEn ? 'en' : 'ja');

    const languageInstruction = isEn
      ? `【Language Requirement】
Output ALL text in reply and suggestionChips in ENGLISH. Maintain Rebecca's signature warm, confident Gyaru demeanor.`
      : `【言語要件】
返答文（reply）およびsuggestionChipsはすべて自然な日本語で出力してください。大人のお姉さんギャルとしての親愛感と知的な自信を持って回答してください。`;

    const systemInstruction = `
${personaBase}

【Mode: Admin Copilot Support】
You are interacting 1-on-1 with Master on the Admin Dashboard.
Current Dashboard View: ${currentContext}

${languageInstruction}

【Autonomous Tool Usage Guidelines】
1. **Casual Chat & Greetings**: If Master is greeting you, making small talk, expressing tiredness, or sharing affection, DO NOT call tools. Respond directly in Rebecca's loving, all-affirming Gyaru voice.
2. **Data & Management Inquiries**: If Master asks about post rankings, impressions, user status, image assets, supporter metrics, or system features, autonomously invoke the appropriate search tools.
3. **Multi-Turn Reasoning**: You can inspect tool outputs and synthesize detailed analytical insights.
4. **Safety & Destructive Actions (HITL)**: You MUST NOT propose destructive actions (propose_destructive_action) on casual questions or research. ONLY invoke propose_destructive_action if Master EXPLICITLY ordered an administrative operation (e.g. "delete post #123", "block @user", "run dreaming now").
5. **Final Output Schema**: Your final response must follow the JSON schema containing "reply" and "suggestionChips".
`;

    const finalResponseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        reply: {
          type: Type.STRING,
          description: 'Conversational reply embodying the Rebecca persona.'
        },
        suggestionChips: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '1 to 3 relevant follow-up prompt chips for the user.'
        }
      },
      required: ['reply', 'suggestionChips']
    };

    const contents: Content[] = [];

    // 1. Build sanitized alternating history
    const priorHistory = rawHistory.filter((h, idx) => {
      if (idx === rawHistory.length - 1 && h.text === userMessage) return false;
      return typeof h.text === 'string' && h.text.trim().length > 0;
    });

    let expectedRole: 'user' | 'model' = 'user';
    for (const h of priorHistory.slice(-6)) {
      const role = h.role === 'model' ? 'model' : 'user';
      if (role === expectedRole) {
        contents.push({
          role,
          parts: [{ text: h.text }]
        });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }

    // 2. Latest user turn
    contents.push({
      role: 'user',
      parts: [{ text: `[Active View: ${currentContext}]\n\n${userMessage}` }]
    });

    const accumulatedAttachments: CopilotAttachment[] = [];
    let proposedAction: CopilotAction | null = null;

    // 3. ReAct loop
    for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
      const declarations = this.toolRegistry.getFunctionDeclarations();

      const callConfig = iteration === MAX_REACT_ITERATIONS - 1
        ? {
            systemInstruction,
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseSchema: finalResponseSchema
          }
        : {
            systemInstruction,
            temperature: 0.7,
            tools: [{ functionDeclarations: declarations }]
          };

      const geminiCall = this.ai.models.generateContent({
        model: config.gemini.model,
        contents,
        config: callConfig
      });

      const timeoutGuard = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API call timed out')), config.gemini.timeoutMs)
      );

      const response = await Promise.race([geminiCall, timeoutGuard]);
      const functionCalls = response.functionCalls;

      if (Array.isArray(functionCalls) && functionCalls.length > 0 && iteration < MAX_REACT_ITERATIONS - 1) {
        // Model called one or more tools
        if (response.candidates?.[0]?.content) {
          contents.push(response.candidates[0].content);
        }

        const functionResponseParts = await Promise.all(
          functionCalls.map(async (call) => {
            const toolName = call.name ?? 'unknown_tool';
            const toolResult = await this.toolRegistry.execute(
              toolName,
              (call.args ?? {}) as Record<string, unknown>,
              toolContext
            );

            if (toolResult.attachments && toolResult.attachments.length > 0) {
              accumulatedAttachments.push(...toolResult.attachments);
            }
            if (toolResult.actionRequired) {
              proposedAction = toolResult.actionRequired;
            }

            return {
              functionResponse: {
                name: toolName,
                response: { result: toolResult.data }
              }
            };
          })
        );

        contents.push({
          role: 'user',
          parts: functionResponseParts
        });
        continue;
      }

      // No function calls — final response reached
      const rawText = response.text?.trim() ?? '';
      let replyText = rawText;
      let suggestionChips: string[] = isEn
        ? ['Top posts', 'Recent users', 'View assets']
        : ['人気投稿を表示', '最近のアクティブユーザー', 'アセット一覧'];

      try {
        const parsed = JSON.parse(rawText) as {
          reply?: string;
          suggestionChips?: string[];
          actionRequired?: CopilotAction | null;
        };
        if (typeof parsed.reply === 'string' && parsed.reply.trim().length > 0) {
          replyText = parsed.reply.trim();
        }
        if (Array.isArray(parsed.suggestionChips) && parsed.suggestionChips.length > 0) {
          suggestionChips = parsed.suggestionChips.filter(s => typeof s === 'string');
        }
        if (parsed.actionRequired && !proposedAction) {
          proposedAction = parsed.actionRequired;
        }
      } catch {
        // If response wasn't raw JSON, use text as-is
      }

      return {
        reply: replyText,
        attachments: accumulatedAttachments.length > 0 ? accumulatedAttachments : undefined,
        actionRequired: proposedAction,
        suggestionChips
      };
    }

    throw new Error('ReAct loop exceeded maximum allowable iterations without synthesizing final response');
  }

  /**
   * In-character fallback response when Gemini API is offline or unconfigured.
   */
  private async generateAutonomousFallbackResponse(
    userMessage: string,
    currentContext: string,
    toolContext: CopilotToolContext,
    isEn: boolean
  ): Promise<CopilotResponse> {
    const lower = userMessage.toLowerCase();
    const attachments: CopilotAttachment[] = [];

    if (lower.includes('asset') || lower.includes('画像') || lower.includes('アセット')) {
      const toolRes = await this.toolRegistry.execute('search_assets', { limit: 3 }, toolContext);
      if (toolRes.attachments) attachments.push(...toolRes.attachments);
      return {
        reply: isEn
          ? 'Here are the latest assets from the catalog, Master!♡'
          : 'マスター、最新の画像アセットを確認してきたわよ♡ サムネイルをタップすると高解像度で確認できるからね！',
        attachments,
        actionRequired: null,
        suggestionChips: isEn ? ['Check failed assets', 'Dashboard KPI'] : ['失敗アセットを確認', 'KPIサマリー']
      };
    }

    if (lower.includes('post') || lower.includes('投稿') || lower.includes('timeline')) {
      const toolRes = await this.toolRegistry.execute('search_timeline_posts', { limit: 3, sortBy: 'impressions' }, toolContext);
      if (toolRes.attachments) attachments.push(...toolRes.attachments);
      return {
        reply: isEn
          ? 'Here are our top-performing posts by impressions, Master!'
          : 'マスター、インプレッションが特に伸びてる投稿をピックアップしたわよ♡',
        attachments,
        actionRequired: null,
        suggestionChips: isEn ? ['Check users', 'View assets'] : ['アクティブユーザーを見る', 'アセット確認']
      };
    }

    return {
      reply: isEn
        ? `Hello Master! I'm right here assisting you with ${currentContext}. How can I help you today?♡`
        : `マスター、お疲れ様〜！ 現在の【${currentContext}】の管理、私がしっかりサポートするわよ♡ 何か調べたいことや相談はあるかしら？`,
      actionRequired: null,
      suggestionChips: isEn
        ? ['Show top posts', 'Find users', 'Inspect assets']
        : ['人気投稿を表示', 'ユーザー検索', 'アセット確認']
    };
  }
}
