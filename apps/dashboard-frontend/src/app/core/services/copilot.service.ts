import { Injectable, inject, signal, effect, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { COPILOT_REPOSITORY, CopilotRepository } from '../ports/copilot.repository';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';
import { DASHBOARD_REPOSITORY, DashboardRepository } from '../ports/dashboard.repository';
import { MEMORY_REPOSITORY, MemoryRepository } from '../ports/memory.repository';
import { ASSETS_REPOSITORY, AssetsRepository } from '../ports/assets.repository';
import { CopilotContextService } from './copilot-context.service';
import { ToastService } from '../../shared/services/toast.service';
import { SettingsService } from './settings.service';
import { TranslationService } from './translation.service';
import { CopilotChatMessage, CopilotAction, UserStatus } from '@rebecca/types';

/**
 * Service managing Rebecca Copilot chat state, message history persistence,
 * real-time LLM interaction, and two-phase Human-In-The-Loop action execution.
 */
@Injectable({
  providedIn: 'root'
})
export class CopilotService {
  private copilotRepo = inject(COPILOT_REPOSITORY);
  private contextService = inject(CopilotContextService);
  private toastService = inject(ToastService);
  private settingsService = inject(SettingsService);
  private translationService = inject(TranslationService);
  private router = inject(Router);

  @Inject(USERS_REPOSITORY) private usersRepo = inject(USERS_REPOSITORY);
  @Inject(DASHBOARD_REPOSITORY) private dashboardRepo = inject(DASHBOARD_REPOSITORY);
  @Inject(MEMORY_REPOSITORY) private memoryRepo = inject(MEMORY_REPOSITORY);
  @Inject(ASSETS_REPOSITORY) private assetsRepo = inject(ASSETS_REPOSITORY);

  private readonly STORAGE_KEY = 'rebecca_copilot_session_history';

  /** Reactive list of chat messages */
  messages = signal<CopilotChatMessage[]>([]);

  /** AI thinking / loading state signal */
  isLoading = signal<boolean>(false);

  constructor() {
    this.hydrateSession();

    // Persist messages whenever signal updates
    effect(() => {
      const current = this.messages();
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
      }
    });

    // Reactively update initial greeting if language switches and no user messages exist yet
    effect(() => {
      const lang = this.translationService.currentLang();
      const current = this.messages();
      if (current.length === 1 && current[0].id === 'initial-greeting') {
        this.messages.set([
          {
            id: 'initial-greeting',
            role: 'model',
            text: this.translationService.t('copilot.greeting'),
            time: new Date().toISOString(),
            actionStatus: 'pending'
          }
        ]);
      }
    });
  }

  private hydrateSession(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = sessionStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.messages.set(parsed);
            return;
          }
        } catch (e) {
          console.warn('Could not restore copilot session:', e);
        }
      }
    }

    // Default welcoming message
    this.messages.set([
      {
        id: 'initial-greeting',
        role: 'model',
        text: this.translationService.t('copilot.greeting'),
        time: new Date().toISOString(),
        actionStatus: 'pending'
      }
    ]);
  }

  /**
   * Sends a user message to Rebecca Copilot and streams the structured response.
   */
  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.isLoading()) return;

    const userMsg: CopilotChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: trimmed,
      time: new Date().toISOString()
    };

    // Append user message immediately
    this.messages.update(prev => [...prev, userMsg]);
    this.isLoading.set(true);

    const historyPayload = this.messages().slice(0, -1).map(m => ({
      role: m.role,
      text: m.text,
      time: m.time
    }));

    const lang = (this.settingsService.selectedLang() === 'en' ? 'en' : 'ja') as 'ja' | 'en';

    this.copilotRepo.chat({
      message: trimmed,
      currentContext: this.contextService.fullContextDescription(),
      history: historyPayload,
      language: lang
    }).subscribe({
      next: (res) => {
        const modelMsg: CopilotChatMessage = {
          id: `msg-${Date.now()}-model`,
          role: 'model',
          text: res.reply,
          time: new Date().toISOString(),
          actionRequired: res.actionRequired || undefined,
          suggestionChips: res.suggestionChips || [],
          actionStatus: res.actionRequired ? 'pending' : undefined
        };

        this.messages.update(prev => [...prev, modelMsg]);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Copilot request failed:', err);
        const isEn = this.translationService.currentLang() === 'en';
        const errorMsg: CopilotChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'model',
          text: isEn 
            ? "Oops, looks like there was a connection glitch... So sorry, Master! Could you try again?♡"
            : 'ちょっと通信エラー（例外）が発生しちゃったみたい……ごめんなさい、マスター。もう一度試してくれるかしら？',
          time: new Date().toISOString()
        };
        this.messages.update(prev => [...prev, errorMsg]);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Approves and executes a proposed system action (Human-In-The-Loop approval).
   */
  approveAction(msgIndex: number, action: CopilotAction): void {
    this.messages.update(prev => {
      const updated = [...prev];
      if (updated[msgIndex]) {
        updated[msgIndex] = { ...updated[msgIndex], actionStatus: 'executed' };
      }
      return updated;
    });

    const payload = action.payload || {};
    const isEn = this.translationService.currentLang() === 'en';

    switch (action.type) {
      case 'BLOCK_USER': {
        const userId = String(payload['userId'] || payload['handle'] || '');
        if (userId) {
          this.usersRepo.bulkUpdateStatus([userId], UserStatus.BLOCKED).subscribe({
            next: () => {
              this.toastService.show(isEn ? `Blocked user ${userId}` : `ユーザー ${userId} を正常にブロックしました`, 'success');
              this.appendSystemAck(isEn ? `Following your approval, I've blocked user ${userId}♡` : `マスターの承認に基づき、ユーザー ${userId} をブロック（除外）したわよ♡`);
            },
            error: () => this.toastService.show(isEn ? `Failed to block user` : `ブロック操作に失敗しました`, 'error')
          });
        }
        break;
      }

      case 'UNBLOCK_USER': {
        const userId = String(payload['userId'] || payload['handle'] || '');
        if (userId) {
          this.usersRepo.bulkUpdateStatus([userId], UserStatus.ACTIVE).subscribe({
            next: () => {
              this.toastService.show(isEn ? `Unblocked user ${userId}` : `ユーザー ${userId} のブロックを解除しました`, 'success');
              this.appendSystemAck(isEn ? `Unblocked user ${userId}.` : `ユーザー ${userId} のブロックを解除したわ。`);
            },
            error: () => this.toastService.show(isEn ? `Failed to unblock user` : `ブロック解除に失敗しました`, 'error')
          });
        }
        break;
      }

      case 'DELETE_POST': {
        const postId = String(payload['postId'] || '');
        if (postId) {
          this.dashboardRepo.deletePosts([postId]).subscribe({
            next: () => {
              this.toastService.show(isEn ? `Deleted post #${postId}` : `投稿 #${postId} を正常に削除しました`, 'success');
              this.appendSystemAck(isEn ? `Deleted post #${postId} from the system and X!` : `指定された投稿 #${postId} をシステムとXから削除完了よ！`);
            },
            error: () => this.toastService.show(isEn ? `Failed to delete post` : `投稿削除に失敗しました`, 'error')
          });
        }
        break;
      }

      case 'FORCE_DREAMING': {
        this.memoryRepo.triggerDreaming().subscribe({
            next: () => {
              this.toastService.show(isEn ? `Force Dreaming completed` : `システムドリーミングを開始しました`, 'success');
              this.appendSystemAck(isEn ? `Memory integration (dreaming) completed successfully♡` : `記憶の統合（ドリーミング）が正常に完了したわ♡`);
            },
            error: () => this.toastService.show(isEn ? `Force Dreaming failed` : `ドリーミング実行に失敗しました`, 'error')
        });
        break;
      }

      case 'REGENERATE_CAPTIONS': {
        this.assetsRepo.regenerateCaptions([]).subscribe({
          next: () => {
            this.toastService.show(isEn ? `Triggered caption regeneration` : `キャプション再生成ジョブを開始しました`, 'success');
            this.appendSystemAck(isEn ? `Started the background job to regenerate failed captions!` : `失敗していたアセットのキャプション再生成ジョブをバックグラウンドで起動したわよ！`);
          },
          error: () => this.toastService.show(isEn ? `Failed to regenerate captions` : `キャプション再生成に失敗しました`, 'error')
        });
        break;
      }

      case 'NAVIGATE_PAGE': {
        const path = String(payload['path'] || '/dashboard');
        this.router.navigate([path]);
        this.toastService.show(isEn ? `Navigated to ${path}` : `${path} へ移動しました`, 'info');
        break;
      }

      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  /**
   * Cancels a proposed system action.
   */
  cancelAction(msgIndex: number): void {
    this.messages.update(prev => {
      const updated = [...prev];
      if (updated[msgIndex]) {
        updated[msgIndex] = { ...updated[msgIndex], actionStatus: 'cancelled' };
      }
      return updated;
    });
    const isEn = this.translationService.currentLang() === 'en';
    this.toastService.show(isEn ? 'Action execution cancelled' : 'アクションの実行をキャンセルしました', 'info');
  }

  private appendSystemAck(text: string): void {
    this.messages.update(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}-ack`,
        role: 'model',
        text,
        time: new Date().toISOString()
      }
    ]);
  }

  /**
   * Clears entire session history.
   */
  clearHistory(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
    this.hydrateSession();
  }
}
