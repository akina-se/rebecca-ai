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
      isEn
    };

    if (!this.ai || !config.gemini.apiKey) {
      return {
        reply: isEn
          ? 'Rebecca AI connection key is not configured.'
          : 'レベッカAIの接続キーが設定されていません。',
        actionRequired: null,
        suggestionChips: isEn ? ['Retry'] : ['もう一度試す']
      };
    }

    try {
      return await this.executeReActLoop(userMessage, currentContext, rawHistory, toolContext, isEn);
    } catch (err) {
      logger.error('Gemini autonomous agent loop failed in Copilot', err);
      return {
        reply: isEn
          ? 'A temporary communication error occurred with the Rebecca AI thinking engine. Please wait a moment and try talking to me again!♡'
          : 'レベッカAIの思考エンジンとの通信中に一時的なエラーが発生したみたい。少し時間を置いてからもう一度話しかけてね♡',
        actionRequired: null,
        suggestionChips: isEn
          ? ['Retry', 'Refresh page']
          : ['もう一度試す', 'ページを再読み込み']
      };
    }
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

${languageInstruction}

【Autonomous Tool Usage Guidelines】
1. **Casual Chat & Greetings**: If Master is greeting you, making small talk, expressing tiredness, or sharing affection, DO NOT call tools. Respond directly in Rebecca's loving, all-affirming Gyaru voice.
2. **Data & Management Inquiries**: If Master asks about post rankings, impressions, user status, image assets, supporter metrics, or system features, autonomously invoke the appropriate search tools.
3. **Multi-Turn Reasoning**: You can inspect tool outputs and synthesize detailed analytical insights.
4. **Safety & Destructive Actions (HITL) & Account Investigation**:
   - Master might specify a user casually by display name, nickname, or partial text (e.g., "AKINAをブロック", "AKINA復活で").
   - You MUST NEVER call \`propose_destructive_action\` with an unverified or speculative account name.
   - If Master asks to block/unblock a user, check [Active View] first. If not already clear, you MUST FIRST autonomously call \`search_users(query='...')\` to find their exact account handle and unique document ID.
   - For \`BLOCK_USER\` or \`UNBLOCK_USER\`, you MUST pass the **exact unique user ID (numeric ID, e.g., '123456789' or document id)** obtained from \`search_users\` as the \`target\`. NEVER pass an ambiguous handle or display name without verifying its exact ID first.
   - Only after confirming the exact user ID from \`search_users\` or [Active View], invoke \`propose_destructive_action\`.
   - If the account does not exist or search returns 0 results, do NOT propose an action; warmly explain to Master that the account could not be found in the system.
5. **Final Output Schema**: You must provide your final answer strictly as a valid JSON object matching the schema: {"reply": "<your conversational answer>", "suggestionChips": ["<chip 1>", "<chip 2>", "<chip 3>"]}. Do NOT wrap the JSON in backticks or markdown code fences (e.g. no \`\`\`json). Output raw JSON only.
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
      const extracted = extractStructuredCopilotResponse(rawText, currentContext, isEn);

      return {
        reply: extracted.reply,
        attachments: accumulatedAttachments.length > 0 ? accumulatedAttachments : undefined,
        actionRequired: proposedAction || extracted.actionRequired || null,
        suggestionChips: extracted.suggestionChips
      };
    }

    throw new Error('ReAct loop exceeded maximum allowable iterations without synthesizing final response');
  }
}

/**
 * Safely extracts and parses JSON payload containing reply and suggestion chips from Gemini output.
 * Strips code fences, isolates outermost JSON objects, and falls back to dynamic context-aware suggestions.
 */
export function extractStructuredCopilotResponse(
  rawText: string,
  currentContext: string,
  isEn: boolean
): {
  reply: string;
  suggestionChips: string[];
  actionRequired?: CopilotAction | null;
} {
  const getContextualFallbackChips = (): string[] => {
    const ctx = (currentContext || '').toLowerCase();
    if (ctx.includes('supporter')) {
      return isEn
        ? ['Supporter overview', 'Check Hall of Fame', 'Reward distribution']
        : ['サポーターの最新状況を確認', 'Hall of Fameの確認', 'リワード配布状況'];
    }
    if (ctx.includes('asset')) {
      return isEn
        ? ['Inspect recent assets', 'Check generation status', 'Filter failed uploads']
        : ['最新の画像アセット一覧', '画像生成ステータス確認', '画像アセットの解析をする'];
    }
    if (ctx.includes('user')) {
      return isEn
        ? ['Search active users', 'Check interaction history', 'Audit user status']
        : ['アクティブユーザー検索', '対話ログの確認', 'ユーザーステータス'];
    }
    if (ctx.includes('campaign')) {
      return isEn
        ? ['Active campaigns', 'Check itinerary slots', 'Event schedule']
        : ['進行中キャンペーンの確認', 'スロット進捗状況', 'スケジュール確認'];
    }
    if (ctx.includes('memory')) {
      return isEn
        ? ['Review persona tuning', 'Timeline summary', 'Inspect core prompt']
        : ['ペルソナ調整状況', 'タイムライン要約確認', 'プロンプト確認'];
    }
    // Dashboard / default
    return isEn
      ? ['Top performing posts', 'Summarize monthly KPI', 'Chat with Rebecca♡']
      : ['タイムラインの人気投稿を見る', '今月のKPI推移を要約', 'レベッカとおしゃべり♡'];
  };

  const cleaned = rawText.trim();
  let parsedObj: { reply?: string; suggestionChips?: string[]; actionRequired?: CopilotAction | null } | null = null;

  // 1. Check if directly parseable as raw JSON
  try {
    parsedObj = JSON.parse(cleaned);
  } catch {
    // 2. Try stripping markdown code fences ```json ... ``` or ``` ... ```
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch && fenceMatch[1]) {
      try {
        parsedObj = JSON.parse(fenceMatch[1].trim());
      } catch {
        // Fall through to bracket search
      }
    }

    // 3. Try finding outermost { ... }
    if (!parsedObj) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsedObj = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {
          // Parse failed completely
        }
      }
    }
  }

  let replyText = cleaned;
  let suggestionChips: string[] = [];
  let actionRequired: CopilotAction | null = null;

  if (parsedObj && typeof parsedObj === 'object') {
    if (typeof parsedObj.reply === 'string' && parsedObj.reply.trim().length > 0) {
      replyText = parsedObj.reply.trim();
    }
    if (Array.isArray(parsedObj.suggestionChips) && parsedObj.suggestionChips.length > 0) {
      suggestionChips = parsedObj.suggestionChips.filter(s => typeof s === 'string' && s.trim().length > 0);
    }
    if (parsedObj.actionRequired) {
      actionRequired = parsedObj.actionRequired;
    }
  } else {
    // If not JSON, but wrapped in code fences, strip them so raw ```json doesn't leak into chat bubble
    const strippedFences = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    replyText = strippedFences;
  }

  if (suggestionChips.length === 0) {
    suggestionChips = getContextualFallbackChips();
  }

  return {
    reply: replyText,
    suggestionChips,
    actionRequired
  };
}
