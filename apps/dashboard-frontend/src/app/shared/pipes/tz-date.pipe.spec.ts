import { TestBed } from '@angular/core/testing';
import { TzDatePipe } from './tz-date.pipe';
import { SettingsService } from '../../core/services/settings.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('TzDatePipe', () => {
  let pipe: TzDatePipe;
  let settingsService: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TzDatePipe, SettingsService]
    });
    pipe = TestBed.inject(TzDatePipe);
    settingsService = TestBed.inject(SettingsService);
  });

  it('should format ISO timestamp according to selected timezone', () => {
    settingsService.selectedTz.set('UTC');
    const result = pipe.transform('2026-08-15T10:30:00.000Z');
    expect(result).toBe('2026/08/15 10:30:00');
  });

  it('should return fallback string for null or undefined value', () => {
    expect(pipe.transform(null)).toBe('Never');
    expect(pipe.transform(undefined, 'N/A')).toBe('N/A');
  });

  it('should preserve special keywords like Never, N/A, and System Deploy', () => {
    expect(pipe.transform('Never')).toBe('Never');
    expect(pipe.transform('N/A')).toBe('N/A');
    expect(pipe.transform('System Deploy')).toBe('System Deploy');
  });

  it('should handle Date objects correctly', () => {
    settingsService.selectedTz.set('UTC');
    const date = new Date('2026-01-01T00:00:00.000Z');
    const result = pipe.transform(date);
    expect(result).toBe('2026/01/01 00:00:00');
  });

  it('should fallback to string when value is invalid date string', () => {
    expect(pipe.transform('not-a-date')).toBe('not-a-date');
  });
});
