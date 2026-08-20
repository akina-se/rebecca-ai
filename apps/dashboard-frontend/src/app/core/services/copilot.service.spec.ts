import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { CopilotService } from './copilot.service';
import { COPILOT_REPOSITORY } from '../ports/copilot.repository';
import { USERS_REPOSITORY } from '../ports/users.repository';
import { DASHBOARD_REPOSITORY } from '../ports/dashboard.repository';
import { MEMORY_REPOSITORY } from '../ports/memory.repository';
import { ASSETS_REPOSITORY } from '../ports/assets.repository';
import { ToastService } from '../../shared/services/toast.service';
import { TranslationService } from './translation.service';
import { SettingsService } from './settings.service';
import { CopilotContextService } from './copilot-context.service';

describe('CopilotService', () => {
  let service: CopilotService;
  let copilotRepoSpy: jasmine.SpyObj<any>;
  let usersRepoSpy: jasmine.SpyObj<any>;
  let dashboardRepoSpy: jasmine.SpyObj<any>;
  let memoryRepoSpy: jasmine.SpyObj<any>;
  let assetsRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let currentLangSignal = signal<'ja' | 'en'>('ja');
  let contextService: CopilotContextService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    currentLangSignal = signal<'ja' | 'en'>('ja');

    copilotRepoSpy = jasmine.createSpyObj('CopilotRepository', ['chat']);
    usersRepoSpy = jasmine.createSpyObj('UsersRepository', ['bulkUpdateStatus']);
    dashboardRepoSpy = jasmine.createSpyObj('DashboardRepository', ['deletePosts']);
    memoryRepoSpy = jasmine.createSpyObj('MemoryRepository', ['triggerDreaming']);
    assetsRepoSpy = jasmine.createSpyObj('AssetsRepository', ['regenerateCaptions']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    const mockTranslationService = {
      currentLang: currentLangSignal,
      translate: (key: string) => key,
      t: (key: string) => key
    };

    const mockSettingsService = {
      selectedLang: currentLangSignal,
      setLanguage: (lang: 'ja' | 'en') => currentLangSignal.set(lang)
    };

    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [
        CopilotService,
        CopilotContextService,
        { provide: TranslationService, useValue: mockTranslationService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: COPILOT_REPOSITORY, useValue: copilotRepoSpy },
        { provide: USERS_REPOSITORY, useValue: usersRepoSpy },
        { provide: DASHBOARD_REPOSITORY, useValue: dashboardRepoSpy },
        { provide: MEMORY_REPOSITORY, useValue: memoryRepoSpy },
        { provide: ASSETS_REPOSITORY, useValue: assetsRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    service = TestBed.inject(CopilotService);
    contextService = TestBed.inject(CopilotContextService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should initialize with an initial model greeting', () => {
    const msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe('model');
  });

  it('should ignore empty message or loading message', () => {
    service.sendMessage('   ');
    expect(copilotRepoSpy.chat).not.toHaveBeenCalled();
  });

  it('should send a message and handle AI reply with suggestions in Japanese and English', () => {
    copilotRepoSpy.chat.and.returnValue(of({
      reply: 'Here is the KPI summary',
      suggestionChips: ['Explain more', 'Export data']
    }));

    service.sendMessage('Summarize KPI');

    expect(copilotRepoSpy.chat).toHaveBeenCalled();
    const msgs = service.messages();
    expect(msgs.length).toBe(3);
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].text).toBe('Summarize KPI');
    expect(msgs[2].role).toBe('model');
    expect(msgs[2].text).toBe('Here is the KPI summary');
    expect(msgs[2].suggestionChips).toEqual(['Explain more', 'Export data']);
    expect(service.isLoading()).toBeFalse();

    // In English
    currentLangSignal.set('en');
    service.sendMessage('Explain DAU');
    expect(copilotRepoSpy.chat).toHaveBeenCalled();
  });

  it('should handle network/API errors gracefully during chat in JA and EN', () => {
    copilotRepoSpy.chat.and.returnValue(throwError(() => new Error('Connection failed')));

    currentLangSignal.set('ja');
    service.sendMessage('Hello?');

    let msgs = service.messages();
    expect(msgs[msgs.length - 1].role).toBe('model');
    expect(msgs[msgs.length - 1].text).toContain('ごめんなさい');

    currentLangSignal.set('en');
    service.sendMessage('Hello?');
    msgs = service.messages();
    expect(msgs[msgs.length - 1].text).toContain('glitch');
  });

  it('should execute BLOCK_USER action on HITL approval in JA and EN', () => {
    currentLangSignal.set('ja');
    usersRepoSpy.bulkUpdateStatus.and.returnValue(of({ success: true, count: 1 }));

    service.approveAction(0, {
      type: 'BLOCK_USER',
      title: 'Block User',
      description: 'Block @malicious_bot',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'malicious_bot' }
    });

    expect(usersRepoSpy.bulkUpdateStatus).toHaveBeenCalledWith(['malicious_bot'], jasmine.any(String));
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/ブロック/), 'success');

    // English mode
    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'BLOCK_USER',
      title: 'Block User',
      description: 'Block @malicious_bot',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'malicious_bot' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Blocked user @malicious_bot', 'success');

    // Error case
    usersRepoSpy.bulkUpdateStatus.and.returnValue(throwError(() => new Error('Failed')));
    service.approveAction(0, {
      type: 'BLOCK_USER',
      title: 'Block User',
      description: 'Block @malicious_bot',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'malicious_bot' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');

    // No target user specified
    contextService.clearFocusedEntity();
    service.approveAction(0, {
      type: 'BLOCK_USER',
      title: 'Block',
      description: '',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should execute UNBLOCK_USER action on HITL approval in JA and EN and fallback to focused entity', () => {
    currentLangSignal.set('ja');
    usersRepoSpy.bulkUpdateStatus.and.returnValue(of({ success: true, count: 1 }));
    contextService.setFocusedEntity({ type: 'user', id: 'focused_user', label: '@focused_user' });

    service.approveAction(0, {
      type: 'UNBLOCK_USER',
      title: 'Unblock User',
      description: 'Unblock user',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: {}
    });

    expect(usersRepoSpy.bulkUpdateStatus).toHaveBeenCalledWith(['focused_user'], jasmine.any(String));

    // English mode
    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'UNBLOCK_USER',
      title: 'Unblock User',
      description: 'Unblock user',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'focused_user' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Unblocked user @focused_user', 'success');

    // Error case
    usersRepoSpy.bulkUpdateStatus.and.returnValue(throwError(() => new Error('Failed')));
    service.approveAction(0, {
      type: 'UNBLOCK_USER',
      title: 'Unblock User',
      description: 'Unblock user',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { userId: 'err_user' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');

    // No target user specified
    contextService.clearFocusedEntity();
    service.approveAction(0, {
      type: 'UNBLOCK_USER',
      title: 'Unblock',
      description: '',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should execute DELETE_POST action on HITL approval in JA and EN and handle missing post and errors', () => {
    currentLangSignal.set('ja');
    dashboardRepoSpy.deletePosts.and.returnValue(of({ success: true, deletedCount: 1 }));

    service.approveAction(0, {
      type: 'DELETE_POST',
      title: 'Delete Post',
      description: 'Delete post #12345',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { postId: '12345' }
    });

    expect(dashboardRepoSpy.deletePosts).toHaveBeenCalledWith(['12345']);

    // English mode
    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'DELETE_POST',
      title: 'Delete Post',
      description: 'Delete post #12345',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { postId: '12345' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Deleted post #12345', 'success');

    // Focused post fallback
    contextService.setFocusedEntity({ type: 'post', id: 'focused_post_99', label: 'post' });
    service.approveAction(0, {
      type: 'DELETE_POST',
      title: 'Delete Post',
      description: 'Delete focused post',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: {}
    });
    expect(dashboardRepoSpy.deletePosts).toHaveBeenCalledWith(['focused_post_99']);

    // Missing post case
    contextService.clearFocusedEntity();
    service.approveAction(0, {
      type: 'DELETE_POST',
      title: 'Delete Post',
      description: 'Delete post',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');

    // Error case
    dashboardRepoSpy.deletePosts.and.returnValue(throwError(() => new Error('Err')));
    service.approveAction(0, {
      type: 'DELETE_POST',
      title: 'Delete Post',
      description: 'Delete post #99',
      impactLevel: 'danger',
      requiresConfirmation: true,
      payload: { postId: '99' }
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should execute FORCE_DREAMING action on HITL approval in JA and EN and handle error', () => {
    currentLangSignal.set('ja');
    memoryRepoSpy.triggerDreaming.and.returnValue(of({ status: 'TRIGGERED' }));

    service.approveAction(0, {
      type: 'FORCE_DREAMING',
      title: 'Force Dreaming',
      description: 'Trigger memory dreaming',
      impactLevel: 'warning',
      requiresConfirmation: true,
      payload: {}
    });

    expect(memoryRepoSpy.triggerDreaming).toHaveBeenCalled();

    // English mode
    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'FORCE_DREAMING',
      title: 'Force Dreaming',
      description: 'Trigger memory dreaming',
      impactLevel: 'warning',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Force Dreaming completed', 'success');

    // Error case
    memoryRepoSpy.triggerDreaming.and.returnValue(throwError(() => new Error('Err')));
    service.approveAction(0, {
      type: 'FORCE_DREAMING',
      title: 'Force Dreaming',
      description: 'Trigger memory dreaming',
      impactLevel: 'warning',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should execute REGENERATE_CAPTIONS action on HITL approval in JA and EN and handle error', () => {
    currentLangSignal.set('ja');
    assetsRepoSpy.regenerateCaptions.and.returnValue(of({ queued: 3 }));

    service.approveAction(0, {
      type: 'REGENERATE_CAPTIONS',
      title: 'Regenerate Captions',
      description: 'Regenerate failed captions',
      impactLevel: 'info',
      requiresConfirmation: true,
      payload: {}
    });

    expect(assetsRepoSpy.regenerateCaptions).toHaveBeenCalled();

    // English mode
    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'REGENERATE_CAPTIONS',
      title: 'Regenerate Captions',
      description: 'Regenerate failed captions',
      impactLevel: 'info',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Triggered caption regeneration', 'success');

    // Error case
    assetsRepoSpy.regenerateCaptions.and.returnValue(throwError(() => new Error('Err')));
    service.approveAction(0, {
      type: 'REGENERATE_CAPTIONS',
      title: 'Regenerate Captions',
      description: 'Regenerate failed captions',
      impactLevel: 'info',
      requiresConfirmation: true,
      payload: {}
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.any(String), 'error');
  });

  it('should execute NAVIGATE_PAGE action on HITL approval in JA and EN', () => {
    currentLangSignal.set('ja');
    service.approveAction(0, {
      type: 'NAVIGATE_PAGE',
      title: 'Go to Settings',
      description: 'Navigate to settings page',
      impactLevel: 'info',
      requiresConfirmation: false,
      payload: { path: '/settings' }
    });

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/settings']);
    expect(toastServiceSpy.show).toHaveBeenCalled();

    currentLangSignal.set('en');
    service.approveAction(0, {
      type: 'NAVIGATE_PAGE',
      title: 'Go to Users',
      description: 'Navigate to users page',
      impactLevel: 'info',
      requiresConfirmation: false,
      payload: { url: '/users' }
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/users']);

    service.approveAction(0, {
      type: 'NAVIGATE_PAGE',
      title: 'Go to Memory',
      description: 'Navigate to memory page',
      impactLevel: 'info',
      requiresConfirmation: false,
      payload: { route: '/memory' }
    });
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/memory']);
  });

  it('should cancel proposed action when cancelAction is called in JA and EN', () => {
    currentLangSignal.set('ja');
    service.cancelAction(0);
    expect(toastServiceSpy.show).toHaveBeenCalled();

    currentLangSignal.set('en');
    service.cancelAction(0);
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Action execution cancelled', 'info');
  });

  it('should clear chat session history', () => {
    service.clearHistory();
    expect(service.messages().length).toBe(1);
  });
});
