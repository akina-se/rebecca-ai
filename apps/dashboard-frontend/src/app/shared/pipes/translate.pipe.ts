import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Impure Angular Pipe that translates dictionary keys reactively when active language changes.
 * Usage in templates: `{{ 'nav.dashboard' | translate }}`
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: string): string {
    if (!key) return '';
    return this.translationService.translate(key);
  }
}
