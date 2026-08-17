import { Injectable, inject, computed } from '@angular/core';
import { SettingsService } from './settings.service';

/**
 * Type-safe dictionary definition for English and Japanese translations across the Admin Dashboard.
 */
const TRANSLATIONS: Record<'ja' | 'en', Record<string, string>> = {
  ja: {
    // Navigation & Global
    'nav.admin': 'Rebecca Admin',
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

    // Common
    'common.loading': '読み込み中...',
    'common.saving': '保存中...',
    'common.deleting': '削除中...',
    'common.save_changes': '変更を保存',
    'common.cancel': 'キャンセル',
    'common.close': '閉じる',
    'common.quick_select': 'クイック選択',
    'common.view_on_x': 'Xで表示',
    'common.action_required': '対応が必要:',
    'common.error': 'エラー:',
    'common.info': '情報:',
    'common.review': '確認する',

    // Dashboard Overview
    'dashboard.alert_captions_failed': '3件の画像キャプション生成に失敗しました。',
    'dashboard.overview': 'パフォーマンス概要',
    'dashboard.filter_7d': '過去7日間',
    'dashboard.filter_30d': '過去30日間',
    'dashboard.filter_ytd': '年初来',
    'dashboard.followers': 'フォロワー数',
    'dashboard.engagement_rate': 'エンゲージメント率',
    'dashboard.dau': 'デイリーアクティブユーザー',
    'dashboard.api_calls': 'APIコール数',
    'dashboard.vs_previous': '前期間比',
    'dashboard.steady': '安定',
    'dashboard.leaderboards': 'リーダーボード',
    'dashboard.top_posts': '高インプレッション投稿',
    'dashboard.top_users': '高エンゲージメントユーザー',
    'dashboard.view_full_ranking': '全体ランキングを表示 →',
    'dashboard.filter_all_time': '全期間',
    'dashboard.filter_yearly': '年間',
    'dashboard.filter_monthly': '月間',
    'dashboard.timeline_history': 'タイムライン投稿履歴',
    'dashboard.search_placeholder': 'ログを検索...',
    'dashboard.select_all': 'すべて選択',
    'dashboard.items_selected': '件の項目を選択中',
    'dashboard.select_items_hint': '操作する項目を選択してください',
    'dashboard.delete_from_x': 'Xから削除',
    'dashboard.deleting': '削除中...',
    'dashboard.status_success': 'SUCCESS',
    'dashboard.status_failed': 'FAILED',
    'dashboard.table_time': '日時',
    'dashboard.table_media': 'メディア',
    'dashboard.table_content': '投稿内容',
    'dashboard.table_impressions': 'インプレッション',
    'dashboard.table_status': 'ステータス',
    'dashboard.table_user_id': 'ユーザーID',
    'dashboard.table_interactions': '対話回数',

    // Memory Page
    'memory.title': 'システム記憶レイヤー',
    'memory.force_dreaming': '強制ドリーミングを実行',
    'memory.processing': '処理中...',
    'memory.saving': '保存中...',
    'memory.layer': 'レイヤー',
    'memory.description': '説明',
    'memory.last_updated': '最終更新日時',
    'memory.layer0_name': 'Layer 0 コアプロンプト',
    'memory.layer0_desc': 'レベッカの不変の核となるキャラクターペルソナプロンプト（読み取り専用）',
    'memory.layer0_note': 'ソースコード内に定義（読み取り専用）',
    'memory.layer1_name': 'Layer 1 拡張ペルソナ調整',
    'memory.layer1_desc': 'Evolution（自己進化）バッチによって生成・調整された動的プロンプト',
    'memory.save_tuning': 'チューニングを保存',
    'memory.layer2_name': 'Layer 2 全体タイムライン要約',
    'memory.layer2_desc': '直近の自発ポストやトレンドの全体的な要約データ',
    'memory.save_summary': '要約を保存',
    'memory.no_layers': 'メモリレイヤーが見つかりません。',

    // Assets Page
    'assets.title': 'アセットライブラリ',
    'assets.upload': 'アセットをアップロード',
    'assets.uploading': 'アップロード中...',
    'assets.bulk_retry': 'AIキャプション再試行',
    'assets.retrying': '再試行中...',
    'assets.search_placeholder': 'ファイル名またはキャプションを検索...',
    'assets.items_selected': '件のアセットを選択中',
    'assets.select_items_hint': '操作するアセットを選択してください',
    'assets.delete': 'アセットを削除',
    'assets.deleting': '削除中...',
    'assets.used_count': '使用回数',
    'assets.name': 'アセット名',
    'assets.caption': '生成キャプション',
    'assets.regenerate': 'キャプション再生成',
    'assets.regenerating': '再生成中...',
    'assets.view_full_size': '原寸表示',
    'assets.no_assets': '条件に一致するアセットが見つかりません。',
    'assets.status_all': 'すべてのステータス',
    'assets.status_generated': '生成完了',
    'assets.status_failed': '失敗',
    'assets.status_pending': '保留中',

    // User Relations Page
    'users.title': 'ユーザー関係',
    'users.search_placeholder': 'ユーザーを検索...',
    'users.users_selected': '名のユーザーを選択中',
    'users.select_users_hint': '操作するユーザーを選択してください',
    'users.block': 'ブロック',
    'users.blocking': 'ブロック中...',
    'users.unblock': 'ブロック解除',
    'users.unblocking': '解除中...',
    'users.table_handle': 'ユーザーID',
    'users.table_interactions': '対話回数',
    'users.table_last_interaction': '最終対話日時',
    'users.table_rag_status': 'RAG記憶',
    'users.table_status': 'ステータス',
    'users.status_active': 'Active',
    'users.status_blocked': 'Blocked',
    'users.status_muted': 'Muted',
    'users.rag_generated': 'Generated',
    'users.rag_none': 'None',
    'users.no_users': 'ユーザーが見つかりません。',

    // User Drawer
    'user_drawer.first_seen': '初回対話日時',
    'user_drawer.last_seen': '最終対話日時',
    'user_drawer.profile_title': '長期プロファイル',
    'user_drawer.attributes': '属性・特徴',
    'user_drawer.add_attribute': '属性を追加...',
    'user_drawer.preferences': '好み・嗜好',
    'user_drawer.add_preference': '好みを追加...',
    'user_drawer.concerns': '悩み・ストレス要因',
    'user_drawer.add_concern': '悩みを追加...',
    'user_drawer.important_memories': '重要エピソード記憶',
    'user_drawer.add_memory': '記憶を追加...',
    'user_drawer.save_profile': 'プロファイルを保存',
    'user_drawer.past_interactions': '過去の対話履歴',
    'user_drawer.block_user': 'ユーザーをブロック',
    'user_drawer.unblock_user': 'ブロックを解除',

    // Post Drawer
    'post_drawer.content': '投稿内容',
    'post_drawer.attached_media': '添付メディア',
    'post_drawer.impressions': 'インプレッション',
    'post_drawer.likes': 'いいね',
    'post_drawer.retweets': 'リポスト',
    'post_drawer.replies': 'リプライ',
    'post_drawer.delete_post': '投稿を削除',

    // Ranking Modal
    'ranking_modal.rank': '順位',

    // Pagination
    'pagination.showing': '全',
    'pagination.page': 'ページ',
    'pagination.posts': '件の投稿',
    'pagination.users': '名のユーザー',
    'pagination.assets': '件のアセット',

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
    'copilot.context_prefix': 'Context: ',
    'copilot.approve': '実行を承認する',
    'copilot.cancel': 'キャンセル',
    'copilot.status_executed': '実行完了（マスター承認済み）',
    'copilot.status_cancelled': '承認がキャンセルされました',
    'copilot.chips_kpi': 'KPI推移を要約して',
    'copilot.chips_engagement': 'エンゲージメント低下の原因は？',
    'copilot.chips_alert': 'システムアラートを確認'
  },
  en: {
    // Navigation & Global
    'nav.admin': 'Rebecca Admin',
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

    // Common
    'common.loading': 'Loading...',
    'common.saving': 'Saving...',
    'common.deleting': 'Deleting...',
    'common.save_changes': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.quick_select': 'Quick Select',
    'common.view_on_x': 'View on X',
    'common.action_required': 'Action Required:',
    'common.error': 'Error:',
    'common.info': 'Info:',
    'common.review': 'Review',

    // Dashboard Overview
    'dashboard.alert_captions_failed': '3 image captions failed generation.',
    'dashboard.overview': 'Performance Overview',
    'dashboard.filter_7d': 'Last 7 Days',
    'dashboard.filter_30d': 'Last 30 Days',
    'dashboard.filter_ytd': 'Year to Date',
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
    'dashboard.items_selected': 'items selected',
    'dashboard.select_items_hint': 'Select items to perform actions',
    'dashboard.delete_from_x': 'Delete from X',
    'dashboard.deleting': 'Deleting...',
    'dashboard.status_success': 'SUCCESS',
    'dashboard.status_failed': 'FAILED',
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
    'memory.saving': 'Saving...',
    'memory.layer': 'Layer',
    'memory.description': 'Description',
    'memory.last_updated': 'Last Updated',
    'memory.layer0_name': 'Layer 0 Core Prompt',
    'memory.layer0_desc': 'Immutable core personality & persona guidelines for Rebecca (Read-Only)',
    'memory.layer0_note': 'Hardcoded in source code (Read-only)',
    'memory.layer1_name': 'Layer 1 Extended Persona Tuning',
    'memory.layer1_desc': 'Dynamic tuning and evolving collective memory updated by Evolution batches',
    'memory.save_tuning': 'Save Tuning',
    'memory.layer2_name': 'Layer 2 Global Timeline Summary',
    'memory.layer2_desc': 'Summary of recent global timeline interactions and ongoing trends',
    'memory.save_summary': 'Save Summary',
    'memory.no_layers': 'No memory layers found.',

    // Assets Page
    'assets.title': 'Assets Library',
    'assets.upload': 'Upload Asset',
    'assets.uploading': 'Uploading...',
    'assets.bulk_retry': 'Retry AI Gen',
    'assets.retrying': 'Retrying...',
    'assets.search_placeholder': 'Search by filename or caption...',
    'assets.items_selected': 'items selected',
    'assets.select_items_hint': 'Select items to perform actions',
    'assets.delete': 'Delete Asset',
    'assets.deleting': 'Deleting...',
    'assets.used_count': 'Used',
    'assets.name': 'Asset Name',
    'assets.caption': 'Generated Caption',
    'assets.regenerate': 'Regenerate',
    'assets.regenerating': 'Regenerating...',
    'assets.view_full_size': 'View Full Size',
    'assets.no_assets': 'No assets found matching your criteria.',
    'assets.status_all': 'All Statuses',
    'assets.status_generated': 'Generated',
    'assets.status_failed': 'Failed',
    'assets.status_pending': 'Pending',

    // User Relations Page
    'users.title': 'User Relations',
    'users.search_placeholder': 'Search users...',
    'users.users_selected': 'users selected',
    'users.select_users_hint': 'Select users to perform actions',
    'users.block': 'Block',
    'users.blocking': 'Blocking...',
    'users.unblock': 'Unblock',
    'users.unblocking': 'Unblocking...',
    'users.table_handle': 'User ID',
    'users.table_interactions': 'Interactions',
    'users.table_last_interaction': 'Last Interaction',
    'users.table_rag_status': 'RAG Memories',
    'users.table_status': 'Status',
    'users.status_active': 'Active',
    'users.status_blocked': 'Blocked',
    'users.status_muted': 'Muted',
    'users.rag_generated': 'Generated',
    'users.rag_none': 'None',
    'users.no_users': 'No users found.',

    // User Drawer
    'user_drawer.first_seen': 'First Seen',
    'user_drawer.last_seen': 'Last Seen',
    'user_drawer.profile_title': 'Long-term Profile',
    'user_drawer.attributes': 'Attributes',
    'user_drawer.add_attribute': 'Add attribute...',
    'user_drawer.preferences': 'Preferences',
    'user_drawer.add_preference': 'Add preference...',
    'user_drawer.concerns': 'Concerns / Stress',
    'user_drawer.add_concern': 'Add concern...',
    'user_drawer.important_memories': 'Important Memories',
    'user_drawer.add_memory': 'Add memory...',
    'user_drawer.save_profile': 'Save Profile',
    'user_drawer.past_interactions': 'Past Interactions',
    'user_drawer.block_user': 'Block User',
    'user_drawer.unblock_user': 'Unblock User',

    // Post Drawer
    'post_drawer.content': 'Post Content',
    'post_drawer.attached_media': 'Attached Media',
    'post_drawer.impressions': 'Impressions',
    'post_drawer.likes': 'Likes',
    'post_drawer.retweets': 'Retweets',
    'post_drawer.replies': 'Replies',
    'post_drawer.delete_post': 'Delete Post',

    // Ranking Modal
    'ranking_modal.rank': 'Rank',

    // Pagination
    'pagination.showing': 'Showing',
    'pagination.page': 'Page',
    'pagination.posts': 'posts',
    'pagination.users': 'users',
    'pagination.assets': 'assets',

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
