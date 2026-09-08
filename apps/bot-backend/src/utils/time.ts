/**
 * Retrieves the current date and time localized to Japan Standard Time (JST).
 *
 * This is crucial for ensuring that chronological operations (e.g., scheduling, logging)
 * remain consistent regardless of the server's local timezone setting.
 *
 * @returns A `Date` object representing the current time in the 'Asia/Tokyo' timezone.
 */
const getJSTDate = () => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
};

/**
 * Formats a Date or ISO date string into standard JST format: YYYY-MM-DD HH:mm JST.
 */
const formatJSTDateTime = (dateOrIso?: Date | string | null): string => {
  if (!dateOrIso) return '';
  const date = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // e.g. "2026/09/08 21:50" -> "2026-09-08 21:50 JST"
  return formatter.format(date).replace(/\//g, '-') + ' JST';
};

export { getJSTDate, formatJSTDateTime };
