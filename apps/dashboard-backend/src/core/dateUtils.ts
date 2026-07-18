import { DateTime } from 'luxon';

/**
 * Calculates the start and end date-times in UTC based on Japan Standard Time (JST) boundaries from a given period type and ISO date parameter.
 * 
 * @param period - The aggregation period ('monthly' | 'yearly' | 'all-time').
 * @param isoDate - The ISO-8601 date string (e.g., '2026-07' or '2026').
 * @returns An object containing the start and end ISO strings in UTC, or null if no range applies.
 */
export function getJstDateRangeInUtc(period: string, isoDate?: string): { start: string; end: string } | null {
  if (period === 'all-time' || !isoDate) {
    return null;
  }
  
  const ZONE_JST = 'Asia/Tokyo';
  
  if (period === 'yearly') {
    const year = parseInt(isoDate, 10);
    if (isNaN(year)) return null;
    // January 1st 00:00 JST -> UTC
    const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: ZONE_JST }).startOf('day').toUTC().toISO();
    // December 31st 23:59:59.999 JST -> UTC
    const end = DateTime.fromObject({ year, month: 12, day: 31 }, { zone: ZONE_JST }).endOf('day').toUTC().toISO();
    
    return { start: start!, end: end! };
  }
  
  if (period === 'monthly') {
    // Parse yyyy-MM (e.g., 2026-07)
    const dt = DateTime.fromFormat(isoDate, 'yyyy-MM', { zone: ZONE_JST });
    if (!dt.isValid) return null;
    
    // Start of month JST -> UTC
    const start = dt.startOf('month').toUTC().toISO();
    // End of month JST -> UTC
    const end = dt.endOf('month').toUTC().toISO();
    
    return { start: start!, end: end! };
  }
  
  return null;
}
