import { Injectable, signal } from '@angular/core';

/**
 * Service for managing application-wide settings, such as language and timezone.
 * Persists selections in localStorage and exposes them as signals for reactivity.
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly LANG_KEY = 'rebecca_lang';
  private readonly TZ_KEY = 'rebecca_tz';

  // Popular timezones list
  readonly timezoneOptions = [
    { label: 'Asia/Tokyo (UTC+9)', value: 'Asia/Tokyo' },
    { label: 'UTC (Greenwich)', value: 'UTC' },
    { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
    { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
    { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Asia/Singapore (SGT)', value: 'Asia/Singapore' },
    { label: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' }
  ];

  readonly languageOptions = [
    { label: '日本誁E(JA)', value: 'ja' },
    { label: 'English (US)', value: 'en' }
  ];

  // Signals for reactive tracking
  selectedLang = signal<string>(localStorage.getItem(this.LANG_KEY) || 'ja');
  selectedTz = signal<string>(localStorage.getItem(this.TZ_KEY) || 'Asia/Tokyo');

  /**
   * Updates the active language setting and persists it.
   * 
   * @param lang - The new language code (e.g. 'ja', 'en').
   */
  setLanguage(lang: string): void {
    localStorage.setItem(this.LANG_KEY, lang);
    this.selectedLang.set(lang);
  }

  /**
   * Updates the active timezone setting and persists it.
   * 
   * @param tz - The IANA timezone identifier (e.g. 'Asia/Tokyo').
   */
  setTimezone(tz: string): void {
    localStorage.setItem(this.TZ_KEY, tz);
    this.selectedTz.set(tz);
  }

  /**
   * Helper to format an ISO date string according to the selected timezone.
   * 
   * @param dateInput - The date input string or Date object.
   * @returns A formatted date string.
   */
  formatDate(dateInput: string | Date | undefined): string {
    if (!dateInput) return 'N/A';
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : 'Invalid Date';
      
      // Use Intl.DateTimeFormat with the reactive timezone signal
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: this.selectedTz(),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const partMap = new Map(parts.map(p => [p.type, p.value]));
      
      return `${partMap.get('year')}-${partMap.get('month')}-${partMap.get('day')} ${partMap.get('hour')}:${partMap.get('minute')}:${partMap.get('second')}`;
    } catch (e) {
      console.error('Error formatting date in timezone', e);
      return typeof dateInput === 'string' ? dateInput : 'Invalid Date';
    }
  }
}
