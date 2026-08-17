import { Injectable, inject, computed } from '@angular/core';
import { SettingsService } from './settings.service';

/**
 * Type-safe dictionary definition for English and Japanese translations across the Admin Dashboard.
 */
const TRANSLATIONS: Record<'ja' | 'en', Record<string, string>> = {
  ja: {
    // Navigation
    'nav.dashboard': 'ダッシュボード',
    'nav.memory': 'メモリ管理',
    'nav.assets': 'アセット管理',
    'nav.users': 'ユーザー関係',
    'nav.settings': 'システム設定',
    'nav.public_site': 'パブリックサイトへ',

    // TopBar
    'topbar.admin': '管理者',
    'topbar.logout': 'ログアウト',
    'topbar.open_copilot': 'Rebecca を開く',

    // Dashboard Overview
    'dashboard.overview': 'パフォーマンス概要',
    'dashboard.period_30d': '過去30日間',
    'dashboard.period_7d': '過去7日間',
    'dashboard.period_24h': '過去24時間',
    'dashboard.followers': 'フォロワー数',
    'dashboard.engagement_rate': 'エンゲージメント率',
    'dashboard.dau': 'デイリーアクティブユーザー',
    'dashboard.api_calls': 'APIコール数',
    'dashboard.vs_previous': '前期間比',
    'dashboard.steady': '安定',
    'dashboard.leaderboards': 'リーダーボード',
    'dashboard.top_posts': '高インプレッション投稿',
    'dashboard.top_users': '高エンゲージメントユーザー',
    'dashboard.view_full_ranking': '全体ランキングを見る →',
    'dashboard.filter_all_time': '全期間',
    'dashboard.filter_yearly': '年間',
    'dashboard.filter_monthly': '月間',
    'dashboard.timeline_history': 'タイムライン投稿履歴',
    'dashboard.search_placeholder': 'ログを検索...',
    'dashboard.select_all': 'すべて選択',
    'dashboard.delete_selected': '件の投稿を削除',
    'dashboard.status_success': '成功',
    'dashboard.status_failed': '失敗',
    'dashboard.showing_posts': '件中',
    'dashboard.page': 'ページ',
    'dashboard.prev_page': '前へ',
    'dashboard.next_page': '次へ',
    'dashboard.table_time': '投稿日時',
    'dashboard.table_media': 'メディア',
    'dashboard.table_content': '投稿内容',
    'dashboard.table_impressions': 'インプレッション',
    'dashboard.table_status': 'ステータス',
    'dashboard.table_user_id': 'ユーザーID',
    'dashboard.table_interactions': '対話回数',

    // Memory Page
    'memory.title': 'システムメモリ階層',
    'memory.force_dreaming': '強制ドリーミング実行',
    'memory.processing': '処理中...',
    'memory.layer': 'レイヤー',
    'memory.description': '説明',
    'memory.last_updated': '最終更新日時',
    'memory.layer0_name': 'Layer 0 コアプロンプト',
    'memory.layer0_desc': 'レベッカの不変の核となるキャラクターペルソナプロンプト（読み取り専用）',
    'memory.layer1_name': 'Layer 1 拡張ペルソナチューニング',
    'memory.layer1_desc': 'Evolution（自己進化）バッチによって生成・調整された動的プロンプト',
    'memory.layer2_name': 'Layer 2 全体タイムラインサマリー',
    'memory.layer2_desc': '直近の自発ポストやトレンドの全体的な要約データ',
    'memory.no_layers': 'メモリレイヤーが見つかりません。',

    // Assets Page
    'assets.title': '画像アセットライブラリ',
    'assets.upload': '画像アップロード',
    'assets.bulk_retry': '失敗したキャプションを一括再生成',
    'assets.search_placeholder': 'ファイル名またはキャプションで検索...',
    'assets.status_all': 'すべてのステータス',
    'assets.status_generated': '生成済み',
    'assets.status_failed': '失敗',
    'assets.filename': 'ファイル名',
    'assets.caption': 'キャプション',
    'assets.last_used': '最終利用日時',
    'assets.delete': 'アセットを削除',
    'assets.regenerate': 'キャプションを再生成',
    'assets.no_assets': 'アセットが見つかりません。',

    // User Relations Page
    'users.title': 'ユーザー関係管理',
    'users.search_placeholder': 'ユーザー名やハンドルで検索...',
    'users.table_handle': 'ユーザーID',
    'users.table_name': '表示名',
    'users.table_interactions': '対話回数',
    'users.table_affinity': '親密度',
    'users.table_last_interaction': '最終対話日時',
    'users.table_rag_status': 'RAG記憶状態',
    'users.table_status': 'アカウント状態',
    'users.status_active': '通常',
    'users.status_blocked': 'ブロック中',
    'users.status_muted': 'ミュート中',
    'users.rag_generated': '生成済み',
    'users.rag_none': '未生成',
    'users.bulk_block': '件をブロック',
    'users.bulk_unblock': '件のブロック解除',

    // Settings Page
    'settings.title': 'システム環境設定',
    'settings.app_language': '表示言語設定',
    'settings.timezone': 'タイムゾーン設定',
    'settings.legal': '法的情報 / ライセンス',
    'settings.view_licenses': 'オープンソースライセンスを確認',

    // Rebecca Copilot
    'copilot.title': 'Rebecca',
    'copilot.greeting': 'こんにちはマスター♡ 私に何か管理の用事かしら？ ダッシュボードの分析やデータ操作、何でも言ってちょうだい！',
    'copilot.placeholder': 'Rebecca に何でも聞いてちょうだい...',
    'copilot.reset': 'セッションをリセット',
    'copilot.close': 'ドロワーを閉じる',
    'copilot.context_prefix': 'コンテクスト: ',
    'copilot.approve': '実行を承認する',
    'copilot.cancel': 'キャンセル',
    'copilot.status_executed': '実行完了（マスター承認済み）',
    'copilot.status_cancelled': '承認がキャンセルされました',
    'copilot.chips_kpi': 'KPI推移を要約して',
    'copilot.chips_engagement': 'エンゲージメント低下の原因は？',
    'copilot.chips_alert': 'システムアラートを確認'
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.memory': 'Memory Management',
    'nav.assets': 'Assets Library',
    'nav.users': 'User Relations',
    'nav.settings': 'Settings',
    'nav.public_site': 'Go to Public Site',

    // TopBar
    'topbar.admin': 'Admin',
    'topbar.logout': 'Logout',
    'topbar.open_copilot': 'Open Rebecca Copilot',

    // Dashboard Overview
    'dashboard.overview': 'Performance Overview',
    'dashboard.period_30d': 'Last 30 Days',
    'dashboard.period_7d': 'Last 7 Days',
    'dashboard.period_24h': 'Last 24 Hours',
    'dashboard.followers': 'Followers',
    'dashboard.engagement_rate': 'Engagement Rate',
    'dashboard.dau': 'Daily Active Users',
    'dashboard.api_calls': 'API Calls',
    'dashboard.vs_previous': 'vs previous period',
    'dashboard.steady': 'Steady',
    'dashboard.leaderboards': 'Leaderboards',
    'dashboard.top_posts': 'Top Posts by Impressions',
    'dashboard.top_users': 'Top Engaged Users',
    'dashboard.view_full_ranking': 'View Full Ranking →',
    'dashboard.filter_all_time': 'All-Time',
    'dashboard.filter_yearly': 'Yearly',
    'dashboard.filter_monthly': 'Monthly',
    'dashboard.timeline_history': 'Timeline Post History',
    'dashboard.search_placeholder': 'Search logs...',
    'dashboard.select_all': 'Select All',
    'dashboard.delete_selected': 'Delete selected posts',
    'dashboard.status_success': 'SUCCESS',
    'dashboard.status_failed': 'FAILED',
    'dashboard.showing_posts': 'Showing',
    'dashboard.page': 'Page',
    'dashboard.prev_page': 'Previous Page',
    'dashboard.next_page': 'Next Page',
    'dashboard.table_time': 'Time',
    'dashboard.table_media': 'Media',
    'dashboard.table_content': 'Post Content',
    'dashboard.table_impressions': 'Impressions',
    'dashboard.table_status': 'Status',
    'dashboard.table_user_id': 'User ID',
    'dashboard.table_interactions': 'Interactions',

    // Memory Page
    'memory.title': 'System Memory Layers',
    'memory.force_dreaming': 'Force Dreaming',
    'memory.processing': 'Processing...',
    'memory.layer': 'Layer',
    'memory.description': 'Description',
    'memory.last_updated': 'Last Updated',
    'memory.layer0_name': 'Layer 0 Core Prompt',
    'memory.layer0_desc': 'Immutable core personality & persona guidelines for Rebecca (Read-Only)',
    'memory.layer1_name': 'Layer 1 Extended Persona Tuning',
    'memory.layer1_desc': 'Dynamic tuning and evolving collective memory updated by Evolution batches',
    'memory.layer2_name': 'Layer 2 Global Timeline Summary',
    'memory.layer2_desc': 'Summary of recent global timeline interactions and ongoing trends',
    'memory.no_layers': 'No memory layers found.',

    // Assets Page
    'assets.title': 'Assets Library',
    'assets.upload': 'Upload Assets',
    'assets.bulk_retry': 'Bulk Retry Failed Captions',
    'assets.search_placeholder': 'Search by filename or caption...',
    'assets.status_all': 'All Statuses',
    'assets.status_generated': 'Generated',
    'assets.status_failed': 'Failed',
    'assets.filename': 'Filename',
    'assets.caption': 'Caption',
    'assets.last_used': 'Last Used',
    'assets.delete': 'Delete Asset',
    'assets.regenerate': 'Regenerate Caption',
    'assets.no_assets': 'No assets found.',

    // User Relations Page
    'users.title': 'User Relations',
    'users.search_placeholder': 'Search by handle or name...',
    'users.table_handle': 'User ID',
    'users.table_name': 'Name',
    'users.table_interactions': 'Interactions',
    'users.table_affinity': 'Affinity',
    'users.table_last_interaction': 'Last Interaction',
    'users.table_rag_status': 'RAG Memories',
    'users.table_status': 'Status',
    'users.status_active': 'ACTIVE',
    'users.status_blocked': 'BLOCKED',
    'users.status_muted': 'MUTED',
    'users.rag_generated': 'Generated',
    'users.rag_none': 'None',
    'users.bulk_block': 'Block selected users',
    'users.bulk_unblock': 'Unblock selected users',

    // Settings Page
    'settings.title': 'System Settings',
    'settings.app_language': 'Application Language',
    'settings.timezone': 'Timezone Settings',
    'settings.legal': 'Legal & Licenses',
    'settings.view_licenses': 'Open Source Licenses',

    // Rebecca Copilot
    'copilot.title': 'Rebecca',
    'copilot.greeting': 'Hello! I am Rebecca. How can I help you manage the system today, Master?♡ Feel free to ask me anything about data analytics or operations!',
    'copilot.placeholder': 'Ask Rebecca anything...',
    'copilot.reset': 'Reset Session',
    'copilot.close': 'Close Drawer',
    'copilot.context_prefix': 'Context: ',
    'copilot.approve': 'Approve & Execute',
    'copilot.cancel': 'Cancel',
    'copilot.status_executed': 'Executed (Approved by Master)',
    'copilot.status_cancelled': 'Action Cancelled',
    'copilot.chips_kpi': 'Summarize KPI trends',
    'copilot.chips_engagement': 'Why did engagement drop?',
    'copilot.chips_alert': 'Check system alerts'
  }
};

/**
 * Service managing real-time language translations across the application using Angular Signals.
 */
@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private settingsService = inject(SettingsService);

  /** Active language signal ('ja' | 'en') */
  currentLang = computed<'ja' | 'en'>(() => {
    const lang = this.settingsService.selectedLang();
    return lang === 'en' ? 'en' : 'ja';
  });

  /**
   * Translates a dictionary key according to the active language.
   * Falls back to English or the key itself if not found.
   * 
   * @param key - The dictionary key (e.g. 'nav.dashboard').
   * @returns The localized text string.
   */
  translate(key: string): string {
    const lang = this.currentLang();
    const table = TRANSLATIONS[lang] || TRANSLATIONS['ja'];
    if (table[key]) return table[key];
    
    // Fallback to English
    if (TRANSLATIONS['en'][key]) return TRANSLATIONS['en'][key];
    return key;
  }

  /**
   * Shorthand helper for translation.
   */
  t(key: string): string {
    return this.translate(key);
  }
}
