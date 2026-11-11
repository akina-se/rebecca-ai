import { DateTime } from 'luxon';

/**
 * Calculates the start and end date-times in UTC based on Japan Standard Time (JST) boundaries.
 * This is primarily used for aggregating data across specific time periods aligned with JST.
 * 
 * @param period - The aggregation period. Accepted values are 'monthly', 'yearly', or 'all-time'.
 * @param isoDate - The ISO-8601 formatted date string representing the target period (e.g., '2026-07' or '2026').
 * @returns An object containing the start and end ISO strings in UTC, or null if the period is 'all-time', invalid, or not provided.
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

/**
 * Calculates start and end UTC timestamps for relative periods ('today', '7d', '30d')
 * or JST calendar periods ('monthly', 'yearly') aligned with JST boundaries.
 * Returns null if the period is 'all-time', undefined, or unsupported.
 *
 * @param period - The period window ('today', '7d', 'weekly', '30d', 'monthly', 'yearly', 'all-time').
 * @param isoDate - Optional specific calendar date ('yyyy-MM' or 'yyyy').
 * @returns Object with start and end ISO strings in UTC, or null.
 */
export function getTimelinePeriodRangeInUtc(period?: string, isoDate?: string): { start: string; end?: string } | null {
  if (!period || period === 'all-time') {
    return null;
  }

  const ZONE_JST = 'Asia/Tokyo';
  const nowJst = DateTime.now().setZone(ZONE_JST);

  if (period === 'today') {
    const start = nowJst.startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    return { start: start!, end: end! };
  }

  if (period === '7d' || period === 'weekly') {
    const start = nowJst.minus({ days: 7 }).startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    return { start: start!, end: end! };
  }

  if (period === '30d') {
    const start = nowJst.minus({ days: 30 }).startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    return { start: start!, end: end! };
  }

  if (isoDate) {
    const jstRange = getJstDateRangeInUtc(period, isoDate);
    if (jstRange) return jstRange;
  }

  if (period === 'monthly') {
    const start = nowJst.startOf('month').toUTC().toISO();
    const end = nowJst.endOf('month').toUTC().toISO();
    return { start: start!, end: end! };
  }

  if (period === 'yearly') {
    const start = nowJst.startOf('year').toUTC().toISO();
    const end = nowJst.endOf('year').toUTC().toISO();
    return { start: start!, end: end! };
  }

  return null;
}
