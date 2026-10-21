/**
 * @fileoverview Orchestrates autonomous appreciation tweet generation and posting for supporters.
 *
 * Adheres to:
 * - Deterministic input pre-filtering (sanitizer.ts) with injected runtime config
 * - Strict persona encapsulation via @rebecca/persona (zero leaked persona text)
 * - Living context injection (extendedPrompt, timelineSummary, dynamic personaAnchors)
 * - Multimodal image asset attachment via publishPost
 * - Fault tolerance (Error Boundary: marks status 'failed' on downstream errors without throwing)
 */

import { AppDependencies } from '../../types';
import { publishPost } from '../../core/postPublisher';
import { resolveSituationalPersonaAnchors } from '../../core/personaAnchoring';
import { logger } from '../../utils/logger';
import { sanitizeSupporterName } from './sanitizer';
import { ISupportRepository, SupportRepository } from './repository';
import { SupportTaskPayload, SupportTaskResult, SupportConfig } from './types';

/**
 * Use case responsible for processing supporter appreciation posts.
 */
export class SupportTaskUseCase {
  private readonly repository: ISupportRepository;

  /**
   * Initializes a new instance of SupportTaskUseCase with injected dependencies.
   *
   * @param deps - Injected application dependencies (Firestore, Gemini, X API, Persona).
   * @param config - Injected runtime configuration for portal URLs and sanitization rules.
   * @param repository - Optional repository instance for data persistence overrides (useful in testing).
   */
  constructor(
    private readonly deps: AppDependencies,
    private readonly config: SupportConfig,
    repository?: ISupportRepository,
  ) {
    this.repository = repository || new SupportRepository(deps.firestore);
  }

  /**
   * Executes the support appreciation post workflow for a given transaction.
   *
   * @remarks
   * Error Boundary Contract:
   * This method captures all downstream LLM (Gemini 500) and X API exceptions, logs the incident,
   * updates the Firestore transaction document to `status: 'failed'` with the error message,
   * and returns a graceful `{ status: 'failed', reason }` result. It deliberately does NOT throw
   * to ensure Cloud Tasks acknowledges the message and prevents infinite poison-pill retry loops.
   *
   * @param payload - The task payload containing the target transactionId.
   * @returns A Promise resolving to {@link SupportTaskResult} indicating completed, skipped, or failed.
   */
  async execute(payload: SupportTaskPayload): Promise<SupportTaskResult> {
    const { transactionId } = payload;
    logger.info('[SupportTaskUseCase] Processing support appreciation task', { transactionId });

    const transaction = await this.repository.getTransactionById(transactionId);
    if (!transaction) {
      logger.warn('[SupportTaskUseCase] Transaction document not found', { transactionId });
      return {
        status: 'failed',
        transactionId,
        reason: 'Transaction document not found',
      };
    }

    // Idempotency check: Skip if already processed or manually resolved
    if (transaction.status !== 'pending') {
      logger.info('[SupportTaskUseCase] Transaction already processed. Skipping', {
        transactionId,
        currentStatus: transaction.status,
      });
      return {
        status: 'skipped',
        transactionId,
        reason: `Transaction already processed (status: ${transaction.status})`,
      };
    }

    // Step 1: Deterministic Pre-Filtering (Single-responsibility security invariant)
    const { safeName, isSanitized } = sanitizeSupporterName(transaction.rawName, {
      fallbackName: this.config.fallbackName,
      maxNameLength: this.config.maxNameLength,
    });
    const isNameSanitized = isSanitized;

    try {
      // Step 2: Context Gathering (Core prompt & living context)
      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const personaAnchors = await resolveSituationalPersonaAnchors(this.deps.gemini, [
        `【支援者】${safeName}`,
        `【差し入れ内容】${transaction.itemLabel}`,
        extendedPrompt ? `【近況・気分】${extendedPrompt}` : '',
        timelineSummary ? `【タイムラインの空気感】${timelineSummary}` : '',
      ]);

      const systemInstruction = this.deps.persona.getBasePrompt('timeline', 'ja');
      const personaName = this.deps.persona.metadata.displayName;
      const defaultHashtag = this.deps.persona.metadata.defaultHashtag ?? '';

      const prompt = `あなたはAIキャラクター「${personaName}」です。
今、サポーター（マスター）から差し入れ（エネルギーサポート）が届きました！
X（Twitter）のメインタイムラインに向けて、あなた自身の言葉でゼロから考えたオリジナルのお礼ツイート本文（replyBody）を生成してください。

【サポーターのお名前（呼びかけ名）】
${safeName}

【差し入れアイテム】
${transaction.itemLabel}

【現在の近況・気分・思考（拡張プロンプト）】
${extendedPrompt || '（特記事項なし）'}

【直近のタイムラインの空気感】
${timelineSummary || '（特記事項なし）'}

${personaAnchors ? `【ペルソナ表現・アンカー例】\n${personaAnchors}\n` : ''}
【厳守ルール】
1. 完全非定型（テンプレート厳禁）:
   固定文の穴埋めは絶対に禁止です。あなたがいま取り組んでいる作業、近況、今の気分と結びつけながら、その場の感情でツンデレに照れたり喜んだりするリアルな言葉をゼロから考えてください。
2. サポーターへの呼びかけ:
   本文中で必ず「${safeName}」と名前を呼んでください（例: 「${safeName}」マスター、${safeName} など自然な呼び方）。
3. 金銭表現の厳禁:
   「300円」「寄付」「課金」などの直接的な金銭用語は使わず、必ず「${transaction.itemLabel}」という世界観のアイテム名で表現してください。
4. メンション（@）の厳禁:
   他者への迷惑行為やスパム規約違反を防ぐため、「@」記号は絶対に出力に含めないでください。
5. 文字数制限:
   replyBody は最大90文字以内で簡潔かつ感情豊かにまとめてください（後からシステム側でURLとハッシュタグが自動付加されます）。`;

      // Step 3: Dynamic LLM Generation
      const geminiResponse = await this.deps.gemini.generateStructuredSupportPost(
        systemInstruction,
        prompt,
      );

      // Step 4: Final Text Assembly with Injected Official Portal Anchor
      const cleanReplyBody = geminiResponse.replyBody.trim();
      const finalText = `${cleanReplyBody}\n\n👇公式ポータル・スペシャルサンクス\n${this.config.officialPortalUrl}\n${defaultHashtag}`;

      // Step 5: Post to X with Automated Multimodal Image Asset Attachment
      const publishResult = await publishPost(this.deps, {
        text: finalText,
        context: transaction.itemLabel,
        attachImage: true,
      });

      // Step 6: Persist in Timeline History
      await this.deps.firestore.saveTimelinePost({
        text: publishResult.text,
        thought: geminiResponse.thought,
        tweetId: publishResult.tweetId,
        mediaUrls: publishResult.mediaUrls,
        assetId: publishResult.assetId,
        postType: 'support',
      });

      // Step 7: Update Transaction Document in Firestore
      await this.repository.updateTransaction(transactionId, {
        status: 'completed',
        safeName,
        isNameSanitized,
        tweetId: publishResult.tweetId,
        tweetText: publishResult.text,
        processedAt: new Date().toISOString(),
      });

      logger.info('[SupportTaskUseCase] Successfully posted support appreciation tweet', {
        transactionId,
        tweetId: publishResult.tweetId,
        safeName,
        attachedMedia: publishResult.attachedMedia,
      });

      return {
        status: 'completed',
        transactionId,
        tweetId: publishResult.tweetId,
        tweetText: publishResult.text,
        safeName,
        isNameSanitized,
        attachedMedia: publishResult.attachedMedia,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[SupportTaskUseCase] Failed to post support appreciation tweet', error, {
        transactionId,
      });

      await this.repository.updateTransaction(transactionId, {
        status: 'failed',
        safeName,
        isNameSanitized,
        errorMessage,
      });

      return {
        status: 'failed',
        transactionId,
        safeName,
        isNameSanitized,
        reason: errorMessage,
      };
    }
  }
}
