import { AppDependencies } from '../../types';
import { getBasePrompt } from '@rebecca/persona';
import { checkAndIncrementRateLimits } from '../../core/rateLimiter';
import { executePostPipeline } from '../../core/postPipeline';
import { downloadImage } from '../../utils/image';
import { logger } from '../../utils/logger';

/**
 * Encapsulates the business logic for the random engagement background job.
 * Responsible for randomly selecting a target user, analyzing their profile and recent activity,
 * and generating a contextually relevant, AI-driven interaction.
 */
export class RandomEngagementUseCase {
  /**
   * Instantiates the RandomEngagementUseCase.
   * 
   * @param deps - The application dependencies required to execute the engagement workflow.
   */
  constructor(private deps: AppDependencies) {}

  /**
   * Executes the random engagement workflow.
   * 
   * This process retrieves a list of target users, filters for those who haven't been engaged recently,
   * analyzes their profile and recent posts to build context, and generates a tailored response using AI.
   * The generated message is then posted as an @mention.
   * 
   * @returns A promise resolving to an object detailing the operation's outcome, 
   *          including the status, the username of the engaged user (if successful), 
   *          and an optional reason string (if skipped or failed).
   */
  async execute(): Promise<{ status: string; processedUser?: string; reason?: string }> {
    logger.info('[RandomEngagementUseCase] Starting Random Engagement Batch');
    try {
      const members = await this.deps.firestore.getListMembersFromCache();

      if (members.length === 0) {
        logger.info('[RandomEngagementUseCase] List cache is empty');
        return { status: 'success' };
      }

      // Fisher-Yates (Knuth) in-place shuffle for uniform randomness
      const shuffled = [...members];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      let targetUser = null;

      for (const user of shuffled) {
        const userDoc = await this.deps.firestore.getUserDoc(user.id);
        if (userDoc?.status === 'BLOCKED') {
          logger.info('[RandomEngagementUseCase] User is blocked by admin. Skipping random engagement', {
            userId: user.id,
          });
          continue;
        }
        const lastInteraction = await this.deps.firestore.getLastListInteraction(user.id);
        if (!lastInteraction) {
          targetUser = user;
          break;
        }
      }

      if (!targetUser) {
        logger.info('[RandomEngagementUseCase] No eligible users found for random engagement');
        return { status: 'success' };
      }

      logger.info('[RandomEngagementUseCase] Targeting user for random engagement', {
        userId: targetUser.id,
      });

      const rateLimitResult = await checkAndIncrementRateLimits(this.deps, targetUser.id);
      if (!rateLimitResult.allowed) {
        logger.warn('[RandomEngagementUseCase] Rate limit hit for user', {
          userId: targetUser.id,
          reason: rateLimitResult.reason,
        });
        return { status: 'skipped', reason: 'rate_limited' };
      }

      const profileResp = await this.deps.xApi.getUserProfile(targetUser.id);
      const username = profileResp.data.username;
      const description = profileResp.data.description || '';
      logger.info('[RandomEngagementUseCase] Resolved username for random engagement', {
        userId: targetUser.id,
        username,
      });
      
      const profilePrompt = `あなたはAIキャラクターのシステムです。ユーザーのX(Twitter)のプロフィール文を分析し、ユーザーの属性や好みをJSONで出力してください。
【プロフィール文】
${description}

出力フォーマット（必ずJSONのみ）:
{
  "attributes": ["社会人", "エンジニア"など],
  "preferences": ["ゲーム", "酒"など]
}`;
      const profileAnalysis = await this.deps.gemini.analyzeUserProfile(profilePrompt);
      logger.info('[RandomEngagementUseCase] Profile analysis completed', {
        userId: targetUser.id,
        profileAnalysis,
      });

      let tweetContext = '';
      let targetTweetId: string | undefined = undefined;
      try {
        const recentTweets = await this.deps.xApi.getUserTweets(targetUser.id, 5);
        if (recentTweets.data && recentTweets.data.length > 0) {
          const latestTweet = recentTweets.data[0];
          targetTweetId = latestTweet.id;
          tweetContext += `\n【直近の投稿内容】\n${latestTweet.text}`;
          
          const mediaKeys = latestTweet.attachments?.mediaKeys;
          const mediaIncludes = recentTweets.includes?.media || [];
          
          const hasMedia = mediaKeys && mediaKeys.length > 0 && mediaIncludes.length > 0;
          if (hasMedia) {
            for (const media of mediaIncludes) {
              if (media.type !== 'photo' || !media.url) continue;

              const { buffer, mimeType } = await downloadImage(media.url);
              const captionPrompt = `この画像に写っている状況、被写体の表情、および感情を説明するテキスト（キャプション）を生成してください。ベクトル検索のクエリとして使用するため、具体的なキーワード（場所、服の色、表情、シチュエーション）を豊富に含めた自然な日本語にしてください。途中で途切れないように、必ず完全な文章（句点で終わる）で出力してください。`;
              const imageCaption = await this.deps.gemini.analyzeImageCaption(buffer, mimeType, captionPrompt);
              
              if (imageCaption) {
                tweetContext += `\n\n【ユーザーが添付した画像の内容】\n${imageCaption}`;
              }
            }
          }
        }
      } catch(e) {
        logger.error('[RandomEngagementUseCase] Failed to fetch recent tweets for random engagement', e, {
          userId: targetUser.id,
        });
      }

      if (!targetTweetId) {
        logger.info('[RandomEngagementUseCase] User has no recent organic tweets to engage with. Skipping', {
          userId: targetUser.id,
        });
        return { status: 'skipped', reason: 'No valid tweets to engage with' };
      }

      const detectPrompt = `このテキストは何語ですか？日本語（ローマ字表記を含む）であれば'ja'、それ以外（主に英語）であれば'en'と、2文字の言語コードのみを出力してください。\nテキスト: "${description + tweetContext}"`;
      const lang = await this.deps.gemini.detectLanguage(detectPrompt);

      const systemPrompt = getBasePrompt('random_engagement', lang);
      const userInput = `【ターゲットユーザー情報】\nユーザー名: @${username}\nプロフィール: ${description}\n分析属性: ${JSON.stringify(profileAnalysis)}\n${tweetContext}\n\n上記を踏まえて、ターゲットユーザーの最近の活動や投稿内容に言及しつつ、不意打ちで話しかける独立したメンション投稿を作成してください。`;

      const structured = await this.deps.gemini.generateStructuredReply(systemPrompt, [], userInput);
      let finalText = structured.reply.trim();
      const thought = structured.thought;

      if (!finalText.includes(`@${username}`)) {
        finalText = `@${username}\n${finalText}`;
      }

      logger.info('[RandomEngagementUseCase] Generated Engagement Text', {
        text: finalText,
      });

      await executePostPipeline(this.deps, {
        postType: 'random_engagement',
        text: finalText,
        thought,
        imageContext: `相手ユーザー: @${username}\nプロフィール: ${description}\n投稿コンテキスト: ${tweetContext}`,
      });

      await this.deps.firestore.updateLastListInteraction(targetUser.id);

      return { status: 'success', processedUser: username };
    } catch (e) {
      logger.error('[RandomEngagementUseCase] Error in RandomEngagementUseCase.execute', e);
      throw e;
    }
  }
}
