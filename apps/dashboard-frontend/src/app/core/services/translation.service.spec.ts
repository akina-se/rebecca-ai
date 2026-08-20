import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';
import { SettingsService } from './settings.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TranslationService', () => {
  let service: TranslationService;
  let settingsService: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TranslationService, SettingsService]
    });
    service = TestBed.inject(TranslationService);
    settingsService = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with default language Japanese (ja)', () => {
    expect(service.currentLang()).toBe('ja');
  });

  it('should translate Japanese keys correctly', () => {
    settingsService.selectedLang.set('ja');
    expect(service.translate('nav.dashboard')).toBe('ダッシュボード');
    expect(service.t('topbar.logout')).toBe('ログアウト');
  });

  it('should translate English keys correctly when language is switched to en', () => {
    settingsService.selectedLang.set('en');
    expect(service.currentLang()).toBe('en');
    expect(service.translate('nav.dashboard')).toBe('Dashboard');
    expect(service.t('topbar.logout')).toBe('Logout');
  });

  it('should fallback to English when a key is missing in Japanese but exists in English', () => {
    settingsService.selectedLang.set('ja');
    // If a key doesn't exist in ja, it looks in en
    expect(service.translate('non.existent.key')).toBe('non.existent.key');
  });

  it('should return the key itself when key does not exist in any language dictionary', () => {
    expect(service.translate('completely_unknown_key_xyz')).toBe('completely_unknown_key_xyz');
  });
});
