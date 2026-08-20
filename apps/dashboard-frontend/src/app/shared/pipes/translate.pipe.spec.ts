import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { SettingsService } from '../../core/services/settings.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let translationService: TranslationService;
  let settingsService: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TranslatePipe, TranslationService, SettingsService]
    });
    pipe = TestBed.inject(TranslatePipe);
    translationService = TestBed.inject(TranslationService);
    settingsService = TestBed.inject(SettingsService);
  });

  it('should translate dictionary key into active language', () => {
    settingsService.selectedLang.set('ja');
    expect(pipe.transform('nav.dashboard')).toBe('ダッシュボード');

    settingsService.selectedLang.set('en');
    expect(pipe.transform('nav.dashboard')).toBe('Dashboard');
  });

  it('should return empty string if input key is empty or null', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null as any)).toBe('');
  });
});
