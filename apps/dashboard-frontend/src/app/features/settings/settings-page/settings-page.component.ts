import { Component } from '@angular/core';
import { DropdownComponent } from '../../../shared/components/molecules/dropdown/dropdown.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [DropdownComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.css'
})
export class SettingsPageComponent {
  langOptions = ['English (US)', '日本語 (JA)'];
  selectedLang = '日本語 (JA)';

  tzOptions = ['Asia/Tokyo (UTC+9)', 'UTC'];
  selectedTz = 'Asia/Tokyo (UTC+9)';

  mockAlert(msg: string) {
    alert(msg);
  }
}
