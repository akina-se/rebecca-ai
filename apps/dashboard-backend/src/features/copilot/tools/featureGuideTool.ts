import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

export type FeatureTopic = 'dreaming' | 'assets' | 'supporters' | 'campaigns' | 'users' | 'timeline';

/**
 * Authoritative guide explaining dashboard modules and operations.
 */
const GUIDES_JA: Record<FeatureTopic, string> = {
  dreaming: '【長期記憶の統合（Dreaming）】日々の未要約な対話ログ（Episodic Buffer）を深夜バッチまたは手動トリガーで解析し、ユーザーの属性・関心事・約束事を抽出してCore Profileに統合・更新するRAG記憶エンジンです。',
  assets: '【アセット管理】生成・アップロードされた画像カタログです。Gemini Visionにより日本語・英語の詳細キャプションと768次元埋め込みベクトルが自動付与され、タイムライン自動投稿時に文脈に合う画像がベクトル検索で紐づけられます。',
  supporters: '【サポーター名簿と特典】Stripe経由での支援実績と名簿掲載希望を管理します。デジタル特典画像の登録、サムネイル生成、公開名簿プレビューが可能です。',
  campaigns: '【キャンペーン管理】旅程（Itinerary）や期間限定イベントの投稿スケジュール、画像スロット、プロモーション設定を管理・実行します。',
  users: '【ユーザー管理】フォロー・インタラクション履歴、アカウント状態（ACTIVE, MUTED, BLOCKED）、および個別のRAG記憶生成ステータスを一覧・詳細確認できます。',
  timeline: '【タイムライン分析】X（旧Twitter）への自発的ポストやリプライ実績のKPI（インプレッション、いいね、リプライ、エンゲージメント率）を期間別に集計・ランキング表示します。'
};

const GUIDES_EN: Record<FeatureTopic, string> = {
  dreaming: '[Memory Consolidation (Dreaming)] The episodic RAG engine that analyzes unsummarized conversation logs during batch runs or manual triggers, extracting user attributes, interests, and key memories into Core Profiles.',
  assets: '[Asset Catalog] Stored image media with Gemini Vision AI captions and 768-dimensional vector embeddings, dynamically retrieved by context during autonomous timeline posts.',
  supporters: '[Supporter Ledger & Rewards] Tracks Stripe contributions, digital reward catalogs, and public supporter roster visibility.',
  campaigns: '[Campaign Management] Configures scheduled itineraries, promotional themes, and event slots for autonomous timeline campaigns.',
  users: '[User Management] Audits followers, interaction history, account moderation status (ACTIVE, MUTED, BLOCKED), and individual RAG profile states.',
  timeline: '[Timeline Analytics] Aggregates performance metrics (impressions, likes, retweets, engagement rate) for posts on X across customizable time windows.'
};

/**
 * Tool for retrieving authoritative domain documentation about dashboard features.
 */
export class GetFeatureGuideTool implements CopilotTool {
  readonly name = 'get_feature_guide';
  readonly description = 'Returns official system documentation and usage guides for dashboard features (dreaming, assets, supporters, campaigns, users, timeline).';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: 'Dashboard feature to query documentation for.',
          enum: ['dreaming', 'assets', 'supporters', 'campaigns', 'users', 'timeline']
        }
      },
      required: ['topic']
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    const rawTopic = typeof params.topic === 'string' ? params.topic.toLowerCase() : '';
    const topic: FeatureTopic = (rawTopic in GUIDES_JA) ? (rawTopic as FeatureTopic) : 'dreaming';
    const guideMap = context.isEn ? GUIDES_EN : GUIDES_JA;
    const content = guideMap[topic] ?? (context.isEn ? 'Feature documentation not found.' : '指定された機能のガイドが見つかりませんでした。');

    return {
      data: {
        topic,
        documentation: content
      }
    };
  }
}
