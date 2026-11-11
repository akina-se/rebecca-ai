import { DateTime } from 'luxon';

/**
 * Standard preset periods for query filtering.
 */
export const StandardTimePeriod = {
  TODAY: 'today',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  ALL_TIME: 'all-time'
} as const;

export type StandardTimePeriod = typeof StandardTimePeriod[keyof typeof StandardTimePeriod];

/**
 * Strict regex for relative duration specifications:
 * e.g., '7d', '14d', '2w', '3m', '1y'
 * Captures positive integer count (>= 1) and duration unit ('d' | 'w' | 'm' | 'y').
 */
export const RELATIVE_DURATION_REGEX = /^([1-9]\d*)([dwmy])$/i;

/**
 * Parsed duration breakdown with normalized Luxon duration units.
 */
export interface RelativeDuration {
  readonly count: number;
  readonly unit: 'days' | 'weeks' | 'months' | 'years';
}

/**
 * Parses a relative duration string into a typed RelativeDuration, or returns null if invalid.
 *
 * @param input - Duration string like '7d', '14d', '2w', '3m', '1y'.
 * @returns RelativeDuration object or null.
 */
export function parseRelativeDuration(input: string): RelativeDuration | null {
  const match = RELATIVE_DURATION_REGEX.exec(input.trim());
  if (!match) return null;

  const count = parseInt(match[1], 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const rawUnit = match[2].toLowerCase();
  switch (rawUnit) {
    case 'd':
      return { count, unit: 'days' };
    case 'w':
      return { count, unit: 'weeks' };
    case 'm':
      return { count, unit: 'months' };
    case 'y':
      return { count, unit: 'years' };
    default:
      return null;
  }
}

/**
 * Calculates the start and end date-times in UTC based on Japan Standard Time (JST) boundaries.
 * This is primarily used for aggregating data across specific time periods aligned with JST.
 * 
 * @param period - The aggregation period. Accepted values are 'monthly', 'yearly', or 'all-time'.
 * @param isoDate - The ISO-8601 formatted date string representing the target period (e.g., '2026-07' or '2026').
 * @returns An object containing the start and end ISO strings in UTC, or null if the period is 'all-time', invalid, or not provided.
 */
export function getJstDateRangeInUtc(period: string, isoDate?: string): { start: string; end: string } | null {
  if (period === StandardTimePeriod.ALL_TIME || !isoDate) {
    return null;
  }
  
  const ZONE_JST = 'Asia/Tokyo';
  
  if (period === StandardTimePeriod.YEARLY) {
    const year = parseInt(isoDate, 10);
    if (isNaN(year)) return null;
    // January 1st 00:00 JST -> UTC
    const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: ZONE_JST }).startOf('day').toUTC().toISO();
    // December 31st 23:59:59.999 JST -> UTC
    const end = DateTime.fromObject({ year, month: 12, day: 31 }, { zone: ZONE_JST }).endOf('day').toUTC().toISO();
    
    return { start: start!, end: end! };
  }
  
  if (period === StandardTimePeriod.MONTHLY) {
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
 * Calculates start and end UTC timestamps for relative duration windows ('7d', '14d', '2w', '3m'),
 * standard named presets ('today', 'weekly', 'monthly', 'yearly'),
 * or JST calendar periods ('monthly', 'yearly' with isoDate) aligned with JST boundaries.
 * Returns null if the period is 'all-time', undefined, or unsupported.
 *
 * @param period - The period window ('today', 'weekly', 'monthly', 'yearly', 'all-time', or duration '7d', '14d', '2w', etc.).
 * @param isoDate - Optional specific calendar date ('yyyy-MM' or 'yyyy').
 * @returns Object with start and end ISO strings in UTC, or null.
 */
export function getTimelinePeriodRangeInUtc(period?: string, isoDate?: string): { start: string; end: string } | null {
  if (!period || period === StandardTimePeriod.ALL_TIME) {
    return null;
  }

  const normalized = period.trim().toLowerCase();
  const ZONE_JST = 'Asia/Tokyo';
  const nowJst = DateTime.now().setZone(ZONE_JST);

  // 1. Strict relative duration parsing (e.g. '7d', '14d', '2w', '3m', '1y')
  const relative = parseRelativeDuration(normalized);
  if (relative) {
    const start = nowJst.minus({ [relative.unit]: relative.count }).startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    if (start && end) {
      return { start, end };
    }
  }

  // 2. Standard named presets
  if (normalized === StandardTimePeriod.TODAY) {
    const start = nowJst.startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    if (start && end) return { start, end };
  }

  if (normalized === StandardTimePeriod.WEEKLY) {
    const start = nowJst.minus({ days: 7 }).startOf('day').toUTC().toISO();
    const end = nowJst.endOf('day').toUTC().toISO();
    if (start && end) return { start, end };
  }

  // 3. Calendar isoDate specification
  if (isoDate) {
    const jstRange = getJstDateRangeInUtc(normalized, isoDate);
    if (jstRange) return jstRange;
  }

  if (normalized === StandardTimePeriod.MONTHLY) {
    const start = nowJst.startOf('month').toUTC().toISO();
    const end = nowJst.endOf('month').toUTC().toISO();
    if (start && end) return { start, end };
  }

  if (normalized === StandardTimePeriod.YEARLY) {
    const start = nowJst.startOf('year').toUTC().toISO();
    const end = nowJst.endOf('year').toUTC().toISO();
    if (start && end) return { start, end };
  }

  return null;
}
