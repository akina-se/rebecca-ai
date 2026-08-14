import { Component, inject } from '@angular/core';
import { DropdownComponent } from '../../../shared/components/molecules/dropdown/dropdown.component';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [DropdownComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css'
})
export class SettingsPageComponent {
  private settingsService = inject(SettingsService);

  langOptions = this.settingsService.languageOptions.map(o => o.label);
  
  get selectedLang(): string {
    const active = this.settingsService.selectedLang();
    return this.settingsService.languageOptions.find(o => o.value === active)?.label || '日本誁E(JA)';
  }

  set selectedLang(label: string) {
    const value = this.settingsService.languageOptions.find(o => o.label === label)?.value || 'ja';
    this.settingsService.setLanguage(value);
  }

  tzOptions = this.settingsService.timezoneOptions.map(o => o.label);

  get selectedTz(): string {
    const active = this.settingsService.selectedTz();
    return this.settingsService.timezoneOptions.find(o => o.value === active)?.label || 'Asia/Tokyo (UTC+9)';
  }

  set selectedTz(label: string) {
    const value = this.settingsService.timezoneOptions.find(o => o.label === label)?.value || 'Asia/Tokyo';
    this.settingsService.setTimezone(value);
  }

  mockAlert(msg: string) {
    alert(msg);
  }
}

