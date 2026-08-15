import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../../core/services/settings.service';

/**
 * Standalone Angular Pipe to format date strings/objects into uniform
 * `YYYY/MM/DD HH:mm:ss` representations honoring the user's selected timezone.
 */
@Pipe({
  name: 'tzDate',
  standalone: true,
  pure: false // Evaluated reactively when timezone signal changes
})
export class TzDatePipe implements PipeTransform {
  private settingsService = inject(SettingsService);

  transform(value: string | Date | null | undefined, fallback: string = 'Never'): string {
    if (!value || value === 'Never' || value === 'N/A' || value === 'System Deploy') {
      return value || fallback;
    }
    const formatted = this.settingsService.formatDate(value);
    if (formatted === 'Invalid Date') {
      return String(value);
    }
    return formatted;
  }
}
