import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SystemSettings } from '@rebecca/types';
import { environment } from '../../../environments/environment';

/**
 * Service for managing application-wide settings, such as language and timezone.
 * Persists selections synchronously in localStorage for zero-latency hydration
 * and synchronizes with the Firestore backend settings API.
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);
  private baseUrl = ((environment as Record<string, unknown>)['apiUrl'] as string) || 'http://localhost:8081/api/v1';

  private readonly LANG_KEY = 'rebecca_lang';
  private readonly TZ_KEY = 'rebecca_tz';

  // Standard 1-hour interval global timezone spectrum (UTC-12:00 to UTC+14:00)
  readonly timezoneOptions = [
    { label: '(UTC-12:00) International Date Line West (Baker Island)', value: 'Etc/GMT+12' },
    { label: '(UTC-11:00) Midway, Samoa, Niue (Pacific/Midway)', value: 'Pacific/Midway' },
    { label: '(UTC-10:00) Hawaii, Honolulu, Tahiti (Pacific/Honolulu)', value: 'Pacific/Honolulu' },
    { label: '(UTC-09:00) Alaska, Anchorage (America/Anchorage)', value: 'America/Anchorage' },
    { label: '(UTC-08:00) Pacific Time: Los Angeles, Vancouver (America/Los_Angeles)', value: 'America/Los_Angeles' },
    { label: '(UTC-07:00) Mountain Time: Denver, Phoenix, Calgary (America/Denver)', value: 'America/Denver' },
    { label: '(UTC-06:00) Central Time: Chicago, Mexico City, Dallas (America/Chicago)', value: 'America/Chicago' },
    { label: '(UTC-05:00) Eastern Time: New York, Toronto, Miami, Bogota (America/New_York)', value: 'America/New_York' },
    { label: '(UTC-04:00) Atlantic Time: Santiago, Halifax, Caracas (America/Santiago)', value: 'America/Santiago' },
    { label: '(UTC-03:00) São Paulo, Buenos Aires, Brasilia (America/Sao_Paulo)', value: 'America/Sao_Paulo' },
    { label: '(UTC-02:00) Mid-Atlantic, South Georgia (America/Noronha)', value: 'America/Noronha' },
    { label: '(UTC-01:00) Azores, Cape Verde (Atlantic/Azores)', value: 'Atlantic/Azores' },
    { label: '(UTC+00:00) UTC, London, Dublin, Lisbon, Casablanca (UTC)', value: 'UTC' },
    { label: '(UTC+01:00) Paris, Berlin, Rome, Madrid, Amsterdam (Europe/Paris)', value: 'Europe/Paris' },
    { label: '(UTC+02:00) Cairo, Jerusalem, Athens, Johannesburg, Helsinki (Africa/Cairo)', value: 'Africa/Cairo' },
    { label: '(UTC+03:00) Moscow, Riyadh, Nairobi, Istanbul, Doha (Europe/Moscow)', value: 'Europe/Moscow' },
    { label: '(UTC+04:00) Dubai, Abu Dhabi, Baku, Tbilisi, Yerevan (Asia/Dubai)', value: 'Asia/Dubai' },
    { label: '(UTC+05:00) Karachi, Tashkent, Islamabad, Yekaterinburg (Asia/Karachi)', value: 'Asia/Karachi' },
    { label: '(UTC+05:30) Mumbai, New Delhi, Kolkata, Bengaluru (Asia/Kolkata)', value: 'Asia/Kolkata' },
    { label: '(UTC+06:00) Dhaka, Almaty, Astana, Omsk (Asia/Dhaka)', value: 'Asia/Dhaka' },
    { label: '(UTC+07:00) Bangkok, Jakarta, Hanoi, Novosibirsk (Asia/Bangkok)', value: 'Asia/Bangkok' },
    { label: '(UTC+08:00) Singapore, Hong Kong, Beijing, Taipei, Perth (Asia/Singapore)', value: 'Asia/Singapore' },
    { label: '(UTC+09:00) Tokyo, Seoul, Osaka, Kyoto (Asia/Tokyo)', value: 'Asia/Tokyo' },
    { label: '(UTC+09:30) Adelaide, Darwin (Australia/Adelaide)', value: 'Australia/Adelaide' },
    { label: '(UTC+10:00) Sydney, Melbourne, Brisbane, Guam (Australia/Sydney)', value: 'Australia/Sydney' },
    { label: '(UTC+11:00) Solomon Islands, New Caledonia, Vladivostok (Pacific/Guadalcanal)', value: 'Pacific/Guadalcanal' },
    { label: '(UTC+12:00) Auckland, Wellington, Fiji, Marshall Islands (Pacific/Auckland)', value: 'Pacific/Auckland' },
    { label: '(UTC+13:00) Tonga, Nuku\'alofa, Samoa (Pacific/Tongatapu)', value: 'Pacific/Tongatapu' },
    { label: '(UTC+14:00) Kiritimati, Line Islands (Pacific/Kiritimati)', value: 'Pacific/Kiritimati' }
  ];

  readonly languageOptions = [
    { label: '日本語 (JA)', value: 'ja' },
    { label: 'English (US)', value: 'en' }
  ];

  // Signals for reactive tracking (hydrated instantly from localStorage)
  selectedLang = signal<string>(localStorage.getItem(this.LANG_KEY) || 'ja');
  selectedTz = signal<string>(localStorage.getItem(this.TZ_KEY) || 'Asia/Tokyo');

  constructor() {
    this.fetchRemoteSettings();
  }

  private fetchRemoteSettings(): void {
    this.http.get<{ data: SystemSettings }>(`${this.baseUrl}/settings`).subscribe({
      next: (res) => {
        if (!res.data) return;
        if (res.data.timezone && !localStorage.getItem(this.TZ_KEY)) {
          this.selectedTz.set(res.data.timezone);
          localStorage.setItem(this.TZ_KEY, res.data.timezone);
        }
        if (res.data.language && !localStorage.getItem(this.LANG_KEY)) {
          this.selectedLang.set(res.data.language);
          localStorage.setItem(this.LANG_KEY, res.data.language);
        }
      },
      error: () => {
        // Fallback gracefully to localStorage
      }
    });
  }

  /**
   * Updates the active language setting and persists it in localStorage and Cloud.
   * 
   * @param lang - The new language code (e.g. 'ja', 'en').
   */
  setLanguage(lang: string): void {
    localStorage.setItem(this.LANG_KEY, lang);
    this.selectedLang.set(lang);
    this.http.patch(`${this.baseUrl}/settings`, { language: lang }).subscribe({
      error: (e) => console.warn('Could not sync language to backend', e)
    });
  }

  /**
   * Updates the active timezone setting and persists it in localStorage and Cloud.
   * 
   * @param tz - The IANA timezone identifier (e.g. 'Asia/Tokyo').
   */
  setTimezone(tz: string): void {
    localStorage.setItem(this.TZ_KEY, tz);
    this.selectedTz.set(tz);
    this.http.patch(`${this.baseUrl}/settings`, { timezone: tz }).subscribe({
      error: (e) => console.warn('Could not sync timezone to backend', e)
    });
  }

  /**
   * Helper to format an ISO date string according to the selected timezone in uniform `YYYY/MM/DD HH:mm:ss` format.
   * 
   * @param dateInput - The date input string or Date object.
   * @returns A formatted date string in `YYYY/MM/DD HH:mm:ss`.
   */
  formatDate(dateInput: string | Date | undefined): string {
    if (!dateInput) return 'N/A';
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (trimmed === 'Never' || trimmed === 'N/A' || trimmed === 'System Deploy') {
        return trimmed;
      }
    }
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
      
      return `${partMap.get('year')}/${partMap.get('month')}/${partMap.get('day')} ${partMap.get('hour')}:${partMap.get('minute')}:${partMap.get('second')}`;
    } catch (e) {
      console.error('Error formatting date in timezone', e);
      return typeof dateInput === 'string' ? dateInput : 'Invalid Date';
    }
  }
}
