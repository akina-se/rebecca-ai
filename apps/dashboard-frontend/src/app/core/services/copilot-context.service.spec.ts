import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CopilotContextService } from './copilot-context.service';
import { TranslationService } from './translation.service';
import { SettingsService } from './settings.service';

describe('CopilotContextService', () => {
  let service: CopilotContextService;
  let translationService: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [CopilotContextService, TranslationService, SettingsService]
    });
    service = TestBed.inject(CopilotContextService);
    translationService = TestBed.inject(TranslationService);
  });

  it('should initialize with default route and compute dashboard context', () => {
    service.currentRoute.set('/dashboard');
    service.clearFocusedEntity();

    expect(service.contextBadge()).toBe(translationService.t('dashboard.overview'));
    expect(service.fullContextDescription()).toContain('Performance Dashboard');
    expect(service.suggestionChips().length).toBe(3);
  });

  it('should compute context for focused post entity', () => {
    service.setFocusedEntity({
      type: 'post',
      id: '1234567890',
      label: 'Test Post',
      details: { text: 'Hello Rebecca' }
    });

    expect(service.contextBadge()).toBe('Post #12345678');
    expect(service.fullContextDescription()).toContain('Currently inspecting post details');
    expect(service.suggestionChips().length).toBe(3);
  });

  it('should compute context for focused user entity', () => {
    service.setFocusedEntity({
      type: 'user',
      id: 'user_42',
      label: '@alice',
      details: { role: 'vip' }
    });

    expect(service.contextBadge()).toBe('User @alice');
    expect(service.fullContextDescription()).toContain('Currently inspecting user details');
  });

  it('should compute context for focused asset entity', () => {
    service.setFocusedEntity({
      type: 'asset',
      id: 'asset_99',
      label: 'beach_rebecca.png'
    });

    expect(service.contextBadge()).toBe('Asset beach_rebecca.png');
    expect(service.fullContextDescription()).toContain('Currently inspecting asset details');
  });

  it('should compute context for general entity', () => {
    service.setFocusedEntity({
      type: 'general',
      id: 'gen_1',
      label: 'General Topic'
    });

    expect(service.contextBadge()).toBe('general: General Topic');
  });

  it('should change suggestion chips and badge based on route in JA and EN', () => {
    service.clearFocusedEntity();

    service.currentRoute.set('/assets');
    expect(service.contextBadge()).toBe(translationService.t('nav.assets'));
    expect(service.fullContextDescription()).toContain('Assets Library');
    expect(service.suggestionChips().length).toBe(3);

    service.currentRoute.set('/users');
    expect(service.contextBadge()).toBe(translationService.t('nav.users'));
    expect(service.suggestionChips().length).toBe(3);

    service.currentRoute.set('/memory');
    expect(service.contextBadge()).toBe(translationService.t('nav.memory'));
    expect(service.suggestionChips().length).toBe(3);

    service.currentRoute.set('/settings');
    expect(service.contextBadge()).toBe(translationService.t('nav.settings'));
    expect(service.suggestionChips().length).toBe(3);

    // Test Japanese entity chips
    service.setFocusedEntity({ type: 'post', id: 'p1', label: 'post' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('トーンと反響を分析');

    service.setFocusedEntity({ type: 'user', id: 'u1', label: 'user' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('このユーザーの過去の対話は？');

    service.setFocusedEntity({ type: 'asset', id: 'a1', label: 'asset' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('キャプションの品質を評価');

    service.clearFocusedEntity();

    // Test English mode
    const settingsService = TestBed.inject(SettingsService);
    settingsService.setLanguage('en');
    service.currentRoute.set('/dashboard');
    expect(service.suggestionChips().length).toBe(3);
    service.currentRoute.set('/assets');
    expect(service.suggestionChips().length).toBe(3);
    service.currentRoute.set('/users');
    expect(service.suggestionChips().length).toBe(3);
    service.currentRoute.set('/memory');
    expect(service.suggestionChips().length).toBe(3);
    service.currentRoute.set('/settings');
    expect(service.suggestionChips().length).toBe(3);

    service.setFocusedEntity({ type: 'post', id: 'p1', label: 'post' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('Analyze tone and engagement');

    service.setFocusedEntity({ type: 'user', id: 'u1', label: 'user' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('Past interactions with user');

    service.setFocusedEntity({ type: 'asset', id: 'a1', label: 'asset' });
    expect(service.suggestionChips().length).toBe(3);
    expect(service.suggestionChips()[0]).toBe('Evaluate caption quality');
  });
});
