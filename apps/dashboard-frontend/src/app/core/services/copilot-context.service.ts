import { Injectable, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface FocusedEntity {
  type: 'post' | 'user' | 'asset' | 'memory' | 'general';
  id: string;
  label: string;
  details?: Record<string, unknown>;
}

/**
 * Service tracking current route and active entity to dynamically supply
 * rich UI context and suggestion chips to Rebecca Copilot.
 */
@Injectable({
  providedIn: 'root'
})
export class CopilotContextService {
  private router = inject(Router);

  /** Active URL path signal */
  currentRoute = signal<string>(typeof window !== 'undefined' ? window.location.pathname : '/dashboard');

  /** Currently focused entity (e.g. opened in right drawer) */
  focusedEntity = signal<FocusedEntity | null>(null);

  constructor() {
    // Also sync on construct if window available
    if (typeof window !== 'undefined' && window.location.pathname) {
      this.currentRoute.set(window.location.pathname);
    }

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute.set(event.urlAfterRedirects || event.url || (typeof window !== 'undefined' ? window.location.pathname : '/dashboard'));
        // Clear drawer focus when moving between main pages
        this.focusedEntity.set(null);
      });
  }

  /**
   * Sets the currently inspected entity context (e.g. from an opened drawer or clicked item).
   */
  setFocusedEntity(entity: FocusedEntity | null): void {
    this.focusedEntity.set(entity);
  }

  /**
   * Clears the currently focused entity context.
   */
  clearFocusedEntity(): void {
    this.focusedEntity.set(null);
  }

  /**
   * Computed concise context badge text displayed at top of AI drawer.
   */
  contextBadge = computed<string>(() => {
    const focused = this.focusedEntity();
    if (focused) {
      if (focused.type === 'post') return `Post #${focused.id.slice(0, 8)}`;
      if (focused.type === 'user') return `User ${focused.label}`;
      if (focused.type === 'asset') return `Asset ${focused.label}`;
      return `${focused.type}: ${focused.label}`;
    }

    const route = this.currentRoute();
    if (route.includes('/assets')) return 'Assets Library';
    if (route.includes('/users')) return 'User Relations';
    if (route.includes('/memory')) return 'Memory Management';
    if (route.includes('/settings')) return 'System Settings';
    return 'Performance Dashboard';
  });

  /**
   * Computed full context description sent to LLM for grounding.
   */
  fullContextDescription = computed<string>(() => {
    const focused = this.focusedEntity();
    if (focused) {
      return `Currently inspecting ${focused.type} details: ID=${focused.id}, Label="${focused.label}", Details=${JSON.stringify(focused.details || {})}`;
    }

    const route = this.currentRoute();
    if (route.includes('/assets')) return 'Page: Assets Library (Managing image assets, caption embeddings, and bulk retries)';
    if (route.includes('/users')) return 'Page: User Relations (Managing followers, interaction metrics, RAG memory status, and blocklist)';
    if (route.includes('/memory')) return 'Page: Memory Management (Managing Persona Core Prompt, Extended Tuning, and Global Timeline Summary)';
    if (route.includes('/settings')) return 'Page: System Settings (Global Timezones and Language Preferences)';
    return 'Page: Performance Dashboard (KPI Overview, Leaderboards, and Timeline Post History)';
  });

  /**
   * Dynamically suggested follow-up chips based on active route and entity.
   */
  suggestionChips = computed<string[]>(() => {
    const focused = this.focusedEntity();
    if (focused) {
      if (focused.type === 'post') {
        return ['トーンと反響を分析', 'この投稿を削除すべき？', '類似の過去投稿を検索'];
      }
      if (focused.type === 'user') {
        return ['このユーザーの過去の対話は？', 'ブロックすべき？', '重要記憶（RAG）を確認'];
      }
      if (focused.type === 'asset') {
        return ['キャプションの品質を評価', 'キャプションを再生成', 'この画像の使用状況'];
      }
    }

    const route = this.currentRoute();
    if (route.includes('/assets')) {
      return ['失敗したキャプションを確認', '未利用アセットを検索', 'キャプションの一括再生成'];
    }
    if (route.includes('/users')) {
      return ['アクティブユーザー上位は？', 'ブロック中ユーザーを確認', 'RAG記憶の生成状況'];
    }
    if (route.includes('/memory')) {
      return ['ペルソナの各層を解説して', '強制ドリーミングを実行', 'Layer 1 の調整アドバイス'];
    }
    if (route.includes('/settings')) {
      return ['タイムゾーン設定の確認', 'クラウド同期ステータス', 'システム診断'];
    }
    return ['KPI推移を要約して', 'エンゲージメント低下の原因は？', 'システムアラートを確認'];
  });
}
