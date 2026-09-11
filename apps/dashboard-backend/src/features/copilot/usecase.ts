import { CopilotRequest, CopilotResponse, PostLeaderboard } from '@rebecca/types';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from '../../config';
import { getActivePersona } from '@rebecca/persona';
import { TimelineRepository } from '../timeline/repository';
import { UsersRepository } from '../users/repository';
import { AssetsRepository } from '../assets/repository';
import { SystemMemoryRepository } from '../system-memory/repository';

/**
 * UseCase for the Admin Copilot feature.
 * Integrates persona definition, real-time Firestore repository access for data analytics,
 * and two-phase Human-In-The-Loop (HITL) safety approval cards for system actions.
 */
export class CopilotUseCase {
  private ai?: GoogleGenAI;

  constructor(
    private timelineRepo?: TimelineRepository,
    private usersRepo?: UsersRepository,
    private assetsRepo?: AssetsRepository,
    private memoryRepo?: SystemMemoryRepository
  ) {
    if (config.gemini.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
    }
  }

  /**
   * Processes an admin chat interaction.
   * 
   * @param request The chat request containing user message, UI context, and conversation history.
   * @returns CopilotResponse structured as JSON.
   */
  async processChat(request: CopilotRequest): Promise<CopilotResponse> {
    const userMessage = (request.message || '').trim();
    const currentContext = request.currentContext || 'Global Dashboard';
    const history = request.history || [];
    const isEn = request.language === 'en';

    try {
      // 1. Autonomous Data Gathering from Repositories (Data Analysis)
      const telemetryContext = await this.gatherLiveTelemetryContext(userMessage, currentContext);

      // 2. Persona System Prompt with Admin Copilot Guidelines
      const activePersona = getActivePersona(config.persona.activeId);
      const personaBase = activePersona.getBasePrompt('copilot', isEn ? 'en' : 'ja');
      const languageInstruction = isEn
        ? `【Language Requirement】
Output ALL text, action titles, descriptions, and suggestion chips in ENGLISH. DO NOT output Japanese.`
        : `【言語要件】
返答文（reply）、actionRequiredのtitle・description、suggestionChipsはすべて日本語で出力してください。`;

      const systemInstruction = `
${personaBase}

【Mode: Admin Copilot】
You are interacting 1-on-1 on the Admin Dashboard.

${languageInstruction}

【Action Proposal Rules (Human-In-The-Loop)】
When proposing destructive or administrative operations, include \`actionRequired\`:
- BLOCK_USER: type="BLOCK_USER", payload={ "userId": "handle_without_at", "handle": "@handle" }, impactLevel="danger", requiresConfirmation=true
- DELETE_POST: type="DELETE_POST", payload={ "postId": "post_id" }, impactLevel="danger", requiresConfirmation=true
- FORCE_DREAMING: type="FORCE_DREAMING", payload={}, impactLevel="warning", requiresConfirmation=true
- REGENERATE_CAPTIONS: type="REGENERATE_CAPTIONS", payload={}, impactLevel="warning", requiresConfirmation=true
- NAVIGATE_PAGE: type="NAVIGATE_PAGE", payload={ "path": "/assets" }, impactLevel="info", requiresConfirmation=false

${isEn ? 'CRITICAL: The active UI language is ENGLISH. Every string in reply, actionRequired, and suggestionChips MUST be in English.' : ''}
`;

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: "Conversational reply embodying the persona."
          },
          actionRequired: {
            type: Type.OBJECT,
            description: "Proposed action for user confirmation, or null if no action needed.",
            nullable: true,
            properties: {
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              impactLevel: { type: Type.STRING },
              requiresConfirmation: { type: Type.BOOLEAN },
              payload: { type: Type.OBJECT }
            },
            required: ["type", "title", "description", "impactLevel", "requiresConfirmation"]
          },
          suggestionChips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-3 context-relevant quick reply / follow-up prompt chips."
          }
        },
        required: ["reply", "suggestionChips"]
      };

      // 3. Invoke Gemini Model if configured
      if (this.ai && config.gemini.apiKey) {
        try {
          const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
          
          // Build valid alternating conversation history starting with 'user'
          const priorHistory = history.filter((h, idx) => {
            if (idx === history.length - 1 && h.text === userMessage) return false;
            return true;
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

          // Always end with current user prompt with dynamic telemetry context
          const userTurnText = (currentContext || telemetryContext)
            ? `[Dashboard UI Context: ${currentContext}]\n[Telemetry Context: ${telemetryContext}]\n\nUser Question: ${userMessage}`
            : userMessage;

          contents.push({
            role: 'user',
            parts: [{ text: userTurnText }]
          });

          const geminiCall = this.ai.models.generateContent({
            model: config.gemini.model,
            contents,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.7
            }
          });

          const timeoutGuard = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API request timed out')), config.gemini.timeoutMs)
          );

          const response = await Promise.race([geminiCall, timeoutGuard]);

          if (response && response.text) {
            const parsed = JSON.parse(response.text) as CopilotResponse;
            return this.normalizeCopilotResponse(parsed, userMessage, isEn);
          }
          throw new Error('Empty or invalid response received from Gemini API');
        } catch (err) {
          console.error('Gemini API call failed:', err);
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

      // 4. In-character autonomous agent fallback (used when Gemini AI is not configured or in offline mock mode)
      return this.generateAutonomousFallbackResponse(userMessage, currentContext, telemetryContext, isEn);
    } catch (globalErr) {
      console.error('Top-level processChat error:', globalErr);
      return {
        reply: isEn
          ? 'An internal error occurred while processing the copilot request. Please try again.'
          : 'コパイロットのリクエスト処理中に内部エラーが発生しました。お手数ですが、再度お試しください。',
        actionRequired: null,
        suggestionChips: isEn
          ? ['Retry', 'Refresh page', 'Check system status']
          : ['もう一度試す', 'ページを再読み込み', 'システム状況を確認']
      };
    }
  }

  /**
   * Gathers live data from Firestore repositories based on the user inquiry and active view.
   */
  private async gatherLiveTelemetryContext(userMessage: string, currentContext: string): Promise<string> {
    const parts: string[] = [];
    const lowerMsg = userMessage.toLowerCase();

    try {
      // 1. KPI Metrics
      if (this.timelineRepo) {
        const metrics = await this.timelineRepo.getMetrics('monthly');
        parts.push(`[KPI Summary]: Followers=${metrics.followers} (${metrics.followersTrend}%), EngagementRate=${metrics.engagementRate}%, DAU=${metrics.dailyActiveUsers}, APICalls=${metrics.apiCalls}`);
      }

      // 2. Query failed assets if asked or on /assets view
      if (this.assetsRepo && (lowerMsg.includes('asset') || lowerMsg.includes('caption') || lowerMsg.includes('アセット') || lowerMsg.includes('キャプション') || currentContext.includes('Assets'))) {
        const assets = await this.assetsRepo.getAll();
        const failed = assets.filter(a => a.status === 'FAILED' || !a.caption);
        parts.push(`[Assets Telemetry]: Total=${assets.length}, FailedCaptions=${failed.length}`);
        if (failed.length > 0) {
          parts.push(`[Failed Assets List]: ${failed.slice(0, 3).map(f => f.filename || f.id).join(', ')}`);
        }
      }

      // 3. Query user data if user handle or users mentioned
      if (this.usersRepo && (lowerMsg.includes('user') || lowerMsg.includes('ユーザー') || lowerMsg.includes('@') || lowerMsg.includes('ブロック') || currentContext.includes('User'))) {
        const userRes = await this.usersRepo.getAll({ limit: 10, sortBy: 'interactions', sortOrder: 'desc' });
        const users = userRes.data || [];
        parts.push(`[Top Engaged Users]: ${users.slice(0, 5).map(u => `${u.name ? `${u.name} (@${u.username})` : (u.username ? `@${u.username}` : u.id)} (Interactions: ${u.interactions}, Status: ${u.status})`).join(', ')}`);
      }

      // 4. Query posts if asked about timeline, impressions, or posts
      if (this.timelineRepo && (lowerMsg.includes('post') || lowerMsg.includes('投稿') || lowerMsg.includes('timeline') || lowerMsg.includes('タイムライン') || lowerMsg.includes('バズ') || currentContext.includes('Post'))) {
        const postRes = await this.timelineRepo.getPosts({ limit: 10, sortBy: 'impressions', sortOrder: 'desc' });
        const topPosts = postRes.data || [];
        parts.push(`[Top Posts by Impressions]: ${topPosts.slice(0, 3).map((p: PostLeaderboard) => `ID=${p.id}, Impressions=${p.impressions}, Text="${p.snippet}"`).join(' | ')}`);
      }
    } catch (e) {
      console.warn('Could not collect all repository telemetry:', e);
    }

    return parts.length > 0 ? parts.join('\n') : 'All systems operating within nominal parameters.';
  }

  /**
   * Normalizes response and ensures valid action structure with proper localization.
   */
  private normalizeCopilotResponse(response: CopilotResponse, userMessage: string, isEn = false): CopilotResponse {
    if (!response.actionRequired) {
      response.actionRequired = this.detectExplicitUserAction(userMessage, isEn);
    }

    if (response.actionRequired) {
      response.actionRequired = this.localizeActionCard(response.actionRequired, isEn);
    }

    return response;
  }

  /**
   * Detects explicit user intent from message text if AI model did not generate an action card.
   */
  private detectExplicitUserAction(userMessage: string, isEn: boolean): CopilotResponse['actionRequired'] {
    const lower = userMessage.toLowerCase();

    if (lower.includes('ブロック') || lower.includes('block') || lower.includes('ミュート')) {
      const match = userMessage.match(/@([a-zA-Z0-9_]+)/);
      const handle = match ? match[0] : '@toxic_user';
      return {
        type: 'BLOCK_USER',
        title: isEn ? `Block User ${handle}` : `ユーザー ${handle} のブロック`,
        description: isEn ? `Block ${handle} from interacting with Master or replying.` : `${handle} をブロックします。今後マスターへのリプライや接触が遮断されます。`,
        impactLevel: 'danger',
        requiresConfirmation: true,
        payload: { userId: handle.replace('@', ''), handle }
      };
    }

    if (lower.includes('削除') || lower.includes('delete') || lower.includes('消して')) {
      return {
        type: 'DELETE_POST',
        title: isEn ? 'Confirm Post Deletion' : '投稿の削除確認',
        description: isEn ? 'Permanently delete this post from system logs and X (Twitter).' : '対象の投稿をシステムおよびX（Twitter）から完全に削除します。',
        impactLevel: 'danger',
        requiresConfirmation: true,
        payload: { postId: 'target_post' }
      };
    }

    if (lower.includes('dreaming') || lower.includes('ドリーミング') || lower.includes('記憶')) {
      return {
        type: 'FORCE_DREAMING',
        title: isEn ? 'Trigger Memory Consolidation (Dreaming)' : '長期記憶の統合（ドリーミング）実行',
        description: isEn ? 'Process recent conversation logs to update long-term RAG memory and evolve persona.' : '未集約の対話ログとユーザー属性を要約・抽出し、長期記憶（RAG）を最新状態にアップデートします。',
        impactLevel: 'warning',
        requiresConfirmation: true,
        payload: {}
      };
    }

    return null;
  }

  /**
   * Sanitizes and localizes action card title, description, and impact levels.
   */
  private localizeActionCard(a: NonNullable<CopilotResponse['actionRequired']>, isEn: boolean): CopilotResponse['actionRequired'] {
    const rawImpact = String(a.impactLevel || (a.type?.includes('DELETE') || a.type?.includes('BLOCK') ? 'danger' : 'warning')).toLowerCase();
    const impactLevel: 'danger' | 'warning' | 'info' = rawImpact.includes('danger') ? 'danger' : rawImpact.includes('warn') ? 'warning' : 'info';
    const actionType = a.type as 'BLOCK_USER' | 'DELETE_POST' | 'FORCE_DREAMING' | 'REGENERATE_CAPTIONS' | 'NAVIGATE_PAGE';
    const payload = (a.payload as Record<string, unknown>) || {};

    let title = a.title || (isEn ? 'Action Confirmation' : 'アクションの実行確認');
    let description = a.description || (isEn ? 'Proceed with this action?' : 'この操作を実行しますか？');

    const containsJa = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(title);

    if (actionType === 'FORCE_DREAMING') {
      title = isEn ? 'Trigger Memory Consolidation (Dreaming)' : '長期記憶の統合（ドリーミング）実行';
      description = isEn ? 'Process recent conversation logs to update long-term RAG memory and evolve persona.' : '未集約の対話ログとユーザー属性を要約・抽出し、長期記憶（RAG）を最新状態にアップデートします。';
    } else if (actionType === 'BLOCK_USER') {
      const activePersona = getActivePersona(config.persona.activeId);
      const callsign = isEn ? activePersona.metadata.userCallsign.en : activePersona.metadata.userCallsign.ja;
      const handle = String(payload['handle'] || payload['userId'] || '').trim();
      const cleanHandle = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '';
      if (isEn) {
        title = cleanHandle ? `Block User ${cleanHandle}` : 'Block User';
        description = cleanHandle ? `Block ${cleanHandle} from interacting with ${callsign} or replying.` : `Block user from interacting with ${callsign}.`;
      } else {
        title = cleanHandle ? `ユーザー ${cleanHandle} のブロック` : 'ユーザーのブロック';
        description = cleanHandle ? `${cleanHandle} をブロックします。今後${callsign}へのリプライや接触が遮断されます。` : `ユーザーをブロックします。今後${callsign}へのリプライや接触が遮断されます。`;
      }
    } else if (actionType === 'DELETE_POST') {
      const postId = String(payload['postId'] || payload['id'] || '').trim();
      const cleanId = postId ? `#${postId.replace(/^#/, '')}` : '';
      if (isEn && containsJa) {
        title = cleanId ? `Confirm Deletion of Post ${cleanId}` : 'Confirm Post Deletion';
        description = 'Permanently delete this post from system logs and X (Twitter).';
      } else if (!isEn && !containsJa) {
        title = cleanId ? `投稿 ${cleanId} の削除確認` : '投稿の削除確認';
        description = '対象の投稿をシステムおよびX（Twitter）から完全に削除します。';
      }
    }

    return {
      type: actionType,
      title,
      description,
      impactLevel,
      requiresConfirmation: a.requiresConfirmation !== false,
      payload
    };
  }

  /**
   * High-fidelity in-character autonomous fallback for local development and offline testing.
   */
  private generateAutonomousFallbackResponse(userMessage: string, currentContext: string, telemetry: string, isEn = false): CopilotResponse {
    const lower = userMessage.toLowerCase();
    const activePersona = getActivePersona(config.persona.activeId);
    const callsign = isEn ? activePersona.metadata.userCallsign.en : activePersona.metadata.userCallsign.ja;

    // 1. User block request
    if (lower.includes('ブロック') || lower.includes('block') || lower.includes('ミュート')) {
      const match = userMessage.match(/@([a-zA-Z0-9_]+)/) || userMessage.match(/(?:block|ブロック|user|ユーザー)\s*@?([a-zA-Z0-9_]+)/i);
      const targetUser = match ? (match[1] || match[0]) : 'spammer_99';
      const cleanHandle = targetUser.startsWith('@') ? targetUser : `@${targetUser}`;
      return {
        reply: isEn
          ? `Understood, ${callsign}. I've prepared the block action card below. Please review and confirm.`
          : `了解しました、${callsign}。対象アカウントのブロック確認カードを準備しました。内容を確認の上、承認してください。`,
        actionRequired: {
          type: 'BLOCK_USER',
          title: isEn ? `Block User ${cleanHandle}` : `ユーザー ${cleanHandle} のブロック`,
          description: isEn ? `Block ${cleanHandle} from interacting with ${callsign} or replying.` : `${cleanHandle} をブロックします。今後${callsign}へのリプライや接触が遮断されます。`,
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { userId: cleanHandle.replace('@', ''), handle: cleanHandle }
        },
        suggestionChips: isEn
          ? ['Cancel Block', 'Check other flagged users', 'View user list']
          : ['ブロックをキャンセル', '他の要注意ユーザーを確認', 'ユーザー一覧を見る']
      };
    }

    // 2. Post delete request
    if (lower.includes('削除') || lower.includes('delete') || lower.includes('消して')) {
      return {
        reply: isEn
          ? `Understood, ${callsign}. I'm ready to purge this post safely from X and the database. Please approve below.`
          : `了解しました、${callsign}。指定された投稿をXおよびデータベースから安全に削除する準備ができました。実行してよろしければ承認してください。`,
        actionRequired: {
          type: 'DELETE_POST',
          title: isEn ? 'Confirm Post Deletion' : '投稿の削除確認',
          description: isEn ? 'Permanently delete this post from system logs and X (Twitter).' : '対象の投稿をシステムおよびX（Twitter）から完全に削除します。',
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { postId: 'post_target' }
        },
        suggestionChips: isEn
          ? ['Cancel', 'Check timeline', 'Analyze another post']
          : ['キャンセル', 'タイムラインを確認', '別の投稿を分析']
      };
    }

    // 3. Failed assets / Captions query
    if (lower.includes('キャプション') || lower.includes('caption') || lower.includes('アセット') || lower.includes('asset') || lower.includes('失敗')) {
      const failedMatch = telemetry.match(/FailedCaptions=(\d+)/);
      const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;
      const countMsgJa = failedCount > 0 ? `現在キャプション生成で待機中またはエラーのアセットが${failedCount}件存在しています。` : `現在キャプション生成で待機中またはエラーのアセットが存在しています。`;
      const countMsgEn = failedCount > 0 ? `There are ${failedCount} asset(s) with pending or failed caption generation.` : `There are assets with pending or failed caption generation.`;
      return {
        reply: isEn
          ? `Checked the telemetry logs, ${callsign}. ${countMsgEn} Want to trigger a bulk retry?`
          : `テレメトリログを確認しました、${callsign}。${countMsgJa}一括でAI再生成（リトライ）を実行しますか？`,
        actionRequired: {
          type: 'REGENERATE_CAPTIONS',
          title: isEn ? 'Bulk Regenerate Captions' : 'キャプション一括再生成',
          description: isEn ? 'Re-run Gemini Vision on failed assets to auto-generate high-quality captions.' : '生成に失敗した画像アセットに対して Gemini 画像解析を再実行し、キャプションを自動補完します。',
          impactLevel: 'warning',
          requiresConfirmation: true,
          payload: {}
        },
        suggestionChips: isEn
          ? ['Regenerate captions', 'Open assets library', 'Check asset health']
          : ['キャプションを再生成', 'アセット一覧を開く', 'アセットの健全性を確認']
      };
    }

    // 4. Force dreaming / Persona update
    if (lower.includes('ドリーミング') || lower.includes('dreaming') || lower.includes('ペルソナ') || lower.includes('記憶')) {
      return {
        reply: isEn
          ? `Time for memory consolidation (Dreaming process). I will analyze recent interaction logs to update long-term memories. Hit approve to start.`
          : `記憶の統合（ドリーミングプロセス）ですね。最近の対話ログを解析して長期記憶を最新状態に最適化します。承認いただければ開始します。`,
        actionRequired: {
          type: 'FORCE_DREAMING',
          title: isEn ? 'Trigger Memory Consolidation (Dreaming)' : '長期記憶の統合（ドリーミング）実行',
          description: isEn ? 'Process recent conversation logs to update long-term RAG memory and evolve persona.' : '未集約の対話ログとユーザー属性を要約・抽出し、長期記憶（RAG）を最新状態にアップデートします。',
          impactLevel: 'warning',
          requiresConfirmation: true,
          payload: {}
        },
        suggestionChips: isEn
          ? ['Trigger Dreaming', 'Check Layer 1 tuning', 'View current memories']
          : ['ドリーミングを実行', 'Layer 1 チューニングを確認', '現在の記憶を見る']
      };
    }

    // 5. Data analytics / KPI query
    if (lower.includes('kpi') || lower.includes('分析') || lower.includes('推移') || lower.includes('フォロワー') || lower.includes('エンゲージメント') || lower.includes('trend') || lower.includes('metric')) {
      const kpiMatch = telemetry.match(/Followers=(\d+)\s*\(([^)]+)\),\s*EngagementRate=([\d.]+)%,\s*DAU=(\d+)/);
      let metricDetails = '';
      if (kpiMatch) {
        const [, followers, trend, engagement, dau] = kpiMatch;
        metricDetails = isEn
          ? `\nFollowers: ${followers} (${trend}), Engagement rate: ${engagement}%, DAU: ${dau}.`
          : `\nフォロワー数: ${followers} (${trend})、エンゲージメント率: ${engagement}%、DAU: ${dau}。`;
      }
      return {
        reply: isEn
          ? `Analyzed the latest performance metrics for you, ${callsign}.${metricDetails}\nAsk me anytime for more in-depth telemetry.`
          : `${callsign}のために最新のパフォーマンスログを分析しました。${metricDetails}\n詳細なデータが必要な場合はいつでもお申し付けください。`,
        actionRequired: null,
        suggestionChips: isEn
          ? ['Engagement breakdown', 'Top 3 posts', 'Active user telemetry']
          : ['エンゲージメント詳細', '人気投稿トップ3', 'アクティブユーザー分析']
      };
    }

    // 6. Default context-aware greeting & response
    return {
      reply: isEn
        ? `How can I help you, ${callsign}?\nI'm fully synced with the current context (${currentContext}) and system telemetry.`
        : `お呼びでしょうか、${callsign}。\n現在のコンテクスト（${currentContext}）とシステムログを同期しています。何でもご指示ください。`,
      actionRequired: null,
      suggestionChips: isEn
        ? ['Summarize KPI trends', 'Check flagged users', 'Inspect asset status']
        : ['KPI推移を要約', '要注意ユーザーをチェック', 'アセットの状態を確認']
    };
  }
}
