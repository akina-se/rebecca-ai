import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SettingsPageComponent } from './settings-page.component';
import { SettingsService } from '../../../core/services/settings.service';

describe('SettingsPageComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;
  let settingsService: SettingsService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent, HttpClientTestingModule],
      providers: [SettingsService]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    settingsService = TestBed.inject(SettingsService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create settings page component', () => {
    expect(component).toBeTruthy();
    expect(component.langOptions.length).toBe(2);
    expect(component.tzOptions.length).toBeGreaterThan(20);
  });

  it('should get and set selectedLang properly', () => {
    component.selectedLang = 'English (US)';
    expect(settingsService.selectedLang()).toBe('en');
    expect(component.selectedLang).toBe('English (US)');

    // Fallback when unknown label
    component.selectedLang = 'Unknown Lang';
    expect(settingsService.selectedLang()).toBe('ja');
  });

  it('should get and set selectedTz properly', () => {
    component.selectedTz = '(UTC+00:00) UTC, London, Dublin, Lisbon, Casablanca (UTC)';
    expect(settingsService.selectedTz()).toBe('UTC');
    expect(component.selectedTz).toContain('UTC');

    // Fallback when unknown label
    component.selectedTz = 'Unknown Timezone';
    expect(settingsService.selectedTz()).toBe('Asia/Tokyo');
  });
});
