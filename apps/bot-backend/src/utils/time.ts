import config from '../config';

/**
 * Structured date and time components localized to a specific IANA time zone.
 */
export interface ZonedDateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  numericYear: number;
  numericMonth: number;
  numericDay: number;
  numericHour: number;
  numericMinute: number;
}

/**
 * Extracts localized calendar and clock components for a given date in the target timezone.
 * Uses ECMA-402 Intl.DateTimeFormat for strict and DST-aware calculations.
 *
 * @param date - The Date instance to evaluate (defaults to current time).
 * @param timezone - Target IANA time zone identifier (defaults to config.appTimezone).
 * @returns Localized date parts with string (zero-padded) and numeric values.
 */
export const getZonedDateParts = (
  date: Date = new Date(),
  timezone: string = config.appTimezone,
): ZonedDateParts => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const findPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '00';

  const year = findPart('year');
  const month = findPart('month');
  const day = findPart('day');
  const hour = findPart('hour');
  const minute = findPart('minute');
  const second = findPart('second');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    numericYear: parseInt(year, 10),
    numericMonth: parseInt(month, 10),
    numericDay: parseInt(day, 10),
    numericHour: parseInt(hour, 10),
    numericMinute: parseInt(minute, 10),
  };
};

/**
 * Formats a Date or ISO-8601 string into a human-readable zoned timestamp: YYYY-MM-DD HH:mm [TZ].
 *
 * @param isoOrDate - ISO-8601 string or Date object representing the timestamp.
 * @param timezone - Target IANA time zone identifier (defaults to config.appTimezone).
 * @returns Formatted date string with timezone abbreviation (e.g. "2026-09-13 07:30 JST"),
 *          or an empty string if input is falsy or invalid.
 */
export const formatZonedDateTime = (
  isoOrDate?: string | Date | null,
  timezone: string = config.appTimezone,
): string => {
  if (!isoOrDate) return '';
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });

  return formatter.format(date).replace(/\//g, '-');
};

