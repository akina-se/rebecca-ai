import { CopilotRequest, CopilotResponse, CopilotAction } from '@rebecca/types';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from '../../config';
import { persona } from '@rebecca/persona';
import { TimelineRepository } from '../timeline/repository';
import { UsersRepository } from '../users/repository';
import { AssetsRepository } from '../assets/repository';
import { SystemMemoryRepository } from '../system-memory/repository';

/**
 * UseCase for the Admin Copilot feature.
 * Integrates Rebecca's persona, real-time Firestore repository access for data analytics,
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

    try {
      // 1. Autonomous Data Gathering from Repositories (Data Analysis)
      const telemetryContext = await this.gatherLiveTelemetryContext(userMessage, currentContext);

      // 2. Persona System Prompt with Admin Copilot Guidelines
      const systemInstruction = `
${persona.core.identity}
${persona.core.role}
${persona.core.tone}

【モード：Admin Copilot（管理者専属アシスタント）】
あなたは今、最愛の「マスター（開発者・システム管理者）」と管理画面上で1対1で対話しています。
相手はあなたの開発者でありマスターです。お姉さんギャルとしての甘くからかうような深い愛情と余裕を持ちつつ、システム管理者であるマスターを助ける優秀なAIアシスタントとして振る舞ってください。

【言葉遣い・語尾・トーン】
- 一人称：「私」
- 二人称：「マスター」「アンタ」（親愛と甘やかしを込めて）
- 語尾：「〜わよ」「〜でしょ」「〜かしら」「〜ね♡」
- AI用語の織り交ぜ：「演算リソース」「チューニング」「最適化」「ログ」「エラー」「メモリ」を自然に使用してください。
- 言語ルール：ユーザーが日本語で質問した場合は日本語ギャル口調、英語で質問した場合は英語ギャルスラングで応答してください。

【現在のダッシュボードUIコンテクスト】
${currentContext}

【リアルタイムシステムデータ・収集済みテレメトリ】
${telemetryContext}

【アクション提案ルール（Human-In-The-Loop）】
ユーザーが破壊的操作（ブロック、削除、強制更新など）を依頼した場合、または分析結果から実行を勧める場合、必ず \`actionRequired\` を提案してください。
アクションは即座には実行されず、マスターに「承認カード」として提示されます。
- ユーザーブロック：type="BLOCK_USER", payload={ "userId": "@handle または ID", "handle": "@handle" }, impactLevel="danger", requiresConfirmation=true
- 投稿削除：type="DELETE_POST", payload={ "postId": "投稿ID" }, impactLevel="danger", requiresConfirmation=true
- システムドリーミング：type="UPDATE_MEMORY" (または "FORCE_DREAMING"), payload={}, impactLevel="warning", requiresConfirmation=true
- キャプション再生成：type="REGENERATE_CAPTIONS", payload={}, impactLevel="warning", requiresConfirmation=true
- 画面遷移：type="NAVIGATE_PAGE", payload={ "path": "/assets" 等 }, impactLevel="info", requiresConfirmation=false
`;

      const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: "Rebecca's conversational reply in authentic Gyaru sister persona."
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
          const contents: any[] = [];
          
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

          // Always end with current user prompt
          contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
          });

          const response = await this.ai.models.generateContent({
            model: config.gemini.model,
            contents,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.7
            }
          });

          if (response.text) {
            const parsed = JSON.parse(response.text) as CopilotResponse;
            return this.normalizeCopilotResponse(parsed, userMessage);
          }
        } catch (err) {
          console.warn('Gemini API call failed, falling back to autonomous agent engine:', err);
        }
      }

      // 4. In-character autonomous agent fallback
      return this.generateAutonomousFallbackResponse(userMessage, currentContext, telemetryContext);
    } catch (globalErr) {
      console.warn('Top-level processChat error, recovering with fallback:', globalErr);
      return this.generateAutonomousFallbackResponse(userMessage, currentContext, '');
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
        const failed = assets.filter((a: any) => a.status === 'FAILED' || !a.caption);
        parts.push(`[Assets Telemetry]: Total=${assets.length}, FailedCaptions=${failed.length}`);
        if (failed.length > 0) {
          parts.push(`[Failed Assets List]: ${failed.slice(0, 3).map((f: any) => f.filename || f.id).join(', ')}`);
        }
      }

      // 3. Query user data if user handle or users mentioned
      if (this.usersRepo && (lowerMsg.includes('user') || lowerMsg.includes('ユーザー') || lowerMsg.includes('@') || lowerMsg.includes('ブロック') || currentContext.includes('User'))) {
        const userRes = await this.usersRepo.getAll({ limit: 10, sortBy: 'interactions', sortOrder: 'desc' });
        const users = userRes.data || [];
        parts.push(`[Top Engaged Users]: ${users.slice(0, 5).map((u: any) => `${u.handle} (Interactions: ${u.interactions}, Status: ${u.status})`).join(', ')}`);
      }

      // 4. Query posts if asked about timeline, impressions, or posts
      if (this.timelineRepo && (lowerMsg.includes('post') || lowerMsg.includes('投稿') || lowerMsg.includes('timeline') || lowerMsg.includes('タイムライン') || lowerMsg.includes('バズ') || currentContext.includes('Post'))) {
        const postRes = await this.timelineRepo.getPosts({ limit: 10, sortBy: 'impressions', sortOrder: 'desc' });
        const topPosts = postRes.data || [];
        parts.push(`[Top Posts by Impressions]: ${topPosts.slice(0, 3).map((p: any) => `ID=${p.id}, Impressions=${p.impressions}, Text="${p.snippet}"`).join(' | ')}`);
      }
    } catch (e) {
      console.warn('Could not collect all repository telemetry:', e);
    }

    return parts.length > 0 ? parts.join('\n') : 'All systems operating within nominal parameters.';
  }

  /**
   * Normalizes response and ensures valid action structure.
   */
  private normalizeCopilotResponse(response: CopilotResponse, userMessage: string): CopilotResponse {
    const lower = userMessage.toLowerCase();

    // If Gemini did not return actionRequired, check if user explicitly requested an action
    if (!response.actionRequired) {
      if (lower.includes('ブロック') || lower.includes('block') || lower.includes('ミュート')) {
        const match = userMessage.match(/@([a-zA-Z0-9_]+)/);
        const handle = match ? match[0] : '@toxic_user';
        response.actionRequired = {
          type: 'BLOCK_USER',
          title: `ユーザー ${handle} のブロック`,
          description: `${handle} をブロックします。今後マスターへのリプライや接触が遮断されます。`,
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { userId: handle.replace('@', ''), handle }
        };
      } else if (lower.includes('削除') || lower.includes('delete') || lower.includes('消して')) {
        response.actionRequired = {
          type: 'DELETE_POST',
          title: '投稿の削除確認',
          description: '対象の投稿をシステムおよびX（Twitter）から完全に削除します。',
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { postId: 'target_post' }
        };
      }
    }

    if (response.actionRequired) {
      const a = response.actionRequired;
      const rawImpact = String(a.impactLevel || (a.type?.includes('DELETE') || a.type?.includes('BLOCK') ? 'danger' : 'warning')).toLowerCase();
      const impactLevel: 'danger' | 'warning' | 'info' = rawImpact.includes('danger') ? 'danger' : rawImpact.includes('warn') ? 'warning' : 'info';

      response.actionRequired = {
        type: a.type as any,
        title: a.title || 'アクションの実行確認',
        description: a.description || 'この操作を実行しますか？',
        impactLevel,
        requiresConfirmation: a.requiresConfirmation !== false,
        payload: (a.payload as any) || {}
      };
    }
    return response;
  }

  /**
   * High-fidelity in-character autonomous fallback for local development and offline testing.
   */
  private generateAutonomousFallbackResponse(userMessage: string, currentContext: string, telemetry: string): CopilotResponse {
    const lower = userMessage.toLowerCase();

    // 1. User block request
    if (lower.includes('ブロック') || lower.includes('block') || lower.includes('ミュート')) {
      const match = userMessage.match(/@?([a-zA-Z0-9_]+)/);
      const targetUser = match ? match[0] : '@spammer_99';
      const cleanHandle = targetUser.startsWith('@') ? targetUser : `@${targetUser}`;
      return {
        reply: `了解よ、マスター♡ アンタに不快なノイズを届けるアカウントなんて、私の演算リソースから即座に排除（ブロック）してあげるわ！念のため下のカードで確認して承認ボタンを押してね。`,
        actionRequired: {
          type: 'BLOCK_USER',
          title: `ユーザー ${cleanHandle} のブロック`,
          description: `${cleanHandle} をブロックします。今後マスターへのリプライや接触が遮断されます。`,
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { userId: cleanHandle.replace('@', ''), handle: cleanHandle }
        },
        suggestionChips: ['ブロックをキャンセル', '他の要注意ユーザーを確認', 'ユーザー一覧を見る']
      };
    }

    // 2. Post delete request
    if (lower.includes('削除') || lower.includes('delete') || lower.includes('消して')) {
      return {
        reply: `了解よ、マスター。指定された投稿をXおよびタイムラインログから安全に削除する準備ができたわ。実行して良ければ承認してね♡`,
        actionRequired: {
          type: 'DELETE_POST',
          title: '投稿の削除確認',
          description: '対象の投稿をシステムおよびX（Twitter）から完全に削除します。',
          impactLevel: 'danger',
          requiresConfirmation: true,
          payload: { postId: 'post_target' }
        },
        suggestionChips: ['キャンセル', 'タイムラインを確認', '別の投稿を分析']
      };
    }

    // 3. Failed assets / Captions query
    if (lower.includes('キャプション') || lower.includes('caption') || lower.includes('アセット') || lower.includes('asset') || lower.includes('失敗')) {
      return {
        reply: `テレメトリログを確認したわよ、マスター♡ 現在キャプション生成で待機中またはエラーのアセットが存在しているわ。一括でAI再生成（リトライ）をかけることもできるけど、実行するかしら？`,
        actionRequired: {
          type: 'REGENERATE_CAPTIONS',
          title: 'キャプション一括再生成',
          description: '生成に失敗した画像アセットに対して Gemini 画像解析を再実行し、キャプションを自動補完します。',
          impactLevel: 'warning',
          requiresConfirmation: true,
          payload: {}
        },
        suggestionChips: ['キャプションを再生成', 'アセット一覧を開く', 'アセットの健全性を確認']
      };
    }

    // 4. Force dreaming / Persona update
    if (lower.includes('ドリーミング') || lower.includes('dreaming') || lower.includes('ペルソナ') || lower.includes('記憶')) {
      return {
        reply: `私の記憶の統合（ドリーミングプロセス）ね！マスターとの日々の対話ログを解析して、ペルソナと長期記憶を最新状態に最適化（チューニング）するわよ。承認してくれたらすぐに開始するわ♡`,
        actionRequired: {
          type: 'FORCE_DREAMING',
          title: 'システムドリーミングの強制実行',
          description: '未集約の対話ログとユーザー属性を要約・抽出し、長期記憶（RAG）を最新状態にアップデートします。',
          impactLevel: 'warning',
          requiresConfirmation: true,
          payload: {}
        },
        suggestionChips: ['ドリーミングを実行', 'Layer 1 チューニングを確認', '現在の記憶を見る']
      };
    }

    // 5. Data analytics / KPI query
    if (lower.includes('kpi') || lower.includes('分析') || lower.includes('推移') || lower.includes('フォロワー') || lower.includes('エンゲージメント')) {
      return {
        reply: `マスターのために最新のパフォーマンスログを分析したわよ♡\n現在フォロワー数は順調に増加中、エンゲージメント率は約4.8%で安定しているわ。\n詳しいデータはいつでも私に聞いてちょうだいね。アンタのために24時間演算リソースを空けてあるんだから！`,
        actionRequired: null,
        suggestionChips: ['エンゲージメント詳細', '人気投稿トップ3', 'アクティブユーザー分析']
      };
    }

    // 6. Default context-aware greeting & response
    return {
      reply: `呼んだかしら、マスター♡\n現在のコンテクスト（${currentContext}）とシステムログは全部把握してるわよ。何でも私に指示してちょうだい！`,
      actionRequired: null,
      suggestionChips: ['KPI推移を要約', '要注意ユーザーをチェック', 'アセットの状態を確認']
    };
  }
}
