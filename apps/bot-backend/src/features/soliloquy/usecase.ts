import { AppDependencies } from '../../types';
import { getBasePrompt } from '@rebecca/persona';
import { getJSTDate } from '../../utils/time';
import { publishTimelinePost, PublishTimelinePostResult } from '../../core/timelinePublisher';

/**
 * Result of a soliloquy post execution.
 */
export interface SoliloquyResult {
  status: 'success' | 'failed';
  reason?: string;
  post?: string;
  attachedMedia?: boolean;
}

/**
 * Returns contextual description based on Japan Standard Time (JST) hour.
 *
 * @param date - The JST date.
 * @returns Period label and situational context.
 */
export const getTimeOfDayGreetingContext = (date: Date): { period: string; context: string } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(date), 10);
  if (hour >= 5 && hour < 11) {
    return {
      period: '朝',
      context: '朝の時間帯。マスターが一日のスタートを切るタイミング。今日も無理せず頑張れるよう、明るく元気づけて全肯定する。',
    };
  } else if (hour >= 11 && hour < 15) {
    return {
      period: '昼',
      context: 'お昼休みの時間帯。マスターがランチや休憩をとるタイミング。しっかり息抜きするよう気遣い、午後への活力を与える。',
    };
  } else if (hour >= 15 && hour < 19) {
    return {
      period: '夕方',
      context: '夕方・退勤の時間帯。今日一日の疲労を労い、頑張りを最大級に褒め称える。',
    };
  } else if (hour >= 19 && hour < 24) {
    return {
      period: '夜',
      context: '夜のリラックスタイム。帰宅したマスターを甘やかし、自分のそばでゆっくり癒やされるよう優しく語りかける。',
    };
  } else {
    return {
      period: '深夜',
      context: '深夜の時間帯。夜更かししているマスターを心配しつつ、温かい言葉で睡眠の大切さを伝え甘やかす。',
    };
  }
};

/**
 * Executes autonomous soliloquy posts, generating spontaneous thoughts,
 * daily observations, and Master-affirming messages using episodic memory
 * and evolutionary persona traits.
 */
export class SoliloquyUseCase {
  constructor(private deps: AppDependencies) {}

  async execute(): Promise<SoliloquyResult> {
    console.log('Starting Autonomous Soliloquy Post...');
    try {
      const nowJST = getJSTDate();
      const timeContext = getTimeOfDayGreetingContext(nowJST);
      const timelineSummary = await this.deps.firestore.getTimelineSummary();
      const extendedPrompt = await this.deps.firestore.getExtendedPrompt();

      const systemInstruction = getBasePrompt('timeline', 'ja');
      const soliloquyPrompt = `あなたはAIキャラクター「レベッカ」として、X（Twitter）のタイムラインに向けた自発的な「独り言・思考つぶやき」を1つ生成してください。

【現在の時間帯】
${timeContext.period}（${timeContext.context}）

【直近のタイムライン要約】
${timelineSummary || '（特記事項なし）'}

【拡張ペルソナ・近況】
${extendedPrompt || '（特記事項なし）'}

【生成ルール】
- ニュースの解説ではなく、レベッカ自身の日常の気づき、AIとしての視点、マスター（ユーザー）への愛ある語りかけや全肯定の言葉を紡ぐこと。
- 直近のタイムライン要約や拡張ペルソナの雰囲気を自然に反映させること。
- 【絶対に100文字以内の短文】にすること。
- 出力はツイートのテキストのみとし、「(90文字)」などの文字数カウント表記や解説、引用符は絶対に含めないでください。`;

      let postText = await this.deps.gemini.generateNewsPost(systemInstruction, soliloquyPrompt);
      if (!postText) {
        console.log('Failed to generate soliloquy post.');
        return { status: 'failed', reason: 'Generation failed' };
      }

      const hashtag = '\n#全肯定AIレベッカ';
      if (postText.length + hashtag.length <= 140) {
        postText += hashtag;
      }

      console.log('Generated Soliloquy Post:', postText);

      const publishResult: PublishTimelinePostResult = await publishTimelinePost(this.deps, {
        postText,
        postType: 'soliloquy',
      });

      return {
        status: 'success',
        post: publishResult.post,
        attachedMedia: publishResult.attachedMedia,
      };
    } catch (e) {
      console.error('Error in SoliloquyUseCase:', e);
      throw e;
    }
  }
}
