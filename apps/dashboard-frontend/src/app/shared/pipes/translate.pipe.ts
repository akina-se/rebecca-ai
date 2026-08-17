import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Pure Angular Pipe that translates dictionary keys reactively based on TranslationService.
 * Usage in templates: `{{ 'nav.dashboard' | translate }}`
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Enables reactive updates when currentLang signal changes without re-instantiation
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: string): string {
    if (!key) return '';
    return this.translationService.translate(key);
  }
}
