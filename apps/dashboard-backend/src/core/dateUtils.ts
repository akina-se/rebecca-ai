import { DateTime } from 'luxon';

/**
 * 期間種別とISO日付パラメータから、日本標準時 (JST) 基準の開始・終了日時（UTC Z 表記）を算出します。
 * 
 * @param period - 集計期間 ('monthly' | 'yearly' | 'all-time')
 * @param isoDate - ISO-8601日付文字列 ('2026-07' や '2026')
 * @returns 開始日時と終了日時のUTC ISO-8601文字列ペア、または範囲なしの場合はnull
 */
export function getJstDateRangeInUtc(period: string, isoDate?: string): { start: string; end: string } | null {
  if (period === 'all-time' || !isoDate) {
    return null;
  }
  
  const ZONE_JST = 'Asia/Tokyo';
  
  if (period === 'yearly') {
    const year = parseInt(isoDate, 10);
    if (isNaN(year)) return null;
    // 日本時間の1月1日 00:00 JST -> UTC
    const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: ZONE_JST }).startOf('day').toUTC().toISO();
    // 日本時間の12-31 23:59:59.999 JST -> UTC
    const end = DateTime.fromObject({ year, month: 12, day: 31 }, { zone: ZONE_JST }).endOf('day').toUTC().toISO();
    
    return { start: start!, end: end! };
  }
  
  if (period === 'monthly') {
    // 2026-07 をパース
    const dt = DateTime.fromFormat(isoDate, 'yyyy-MM', { zone: ZONE_JST });
    if (!dt.isValid) return null;
    
    // 日本時間の月初0時 -> UTC
    const start = dt.startOf('month').toUTC().toISO();
    // 日本時間の月末23:59:59.999 -> UTC
    const end = dt.endOf('month').toUTC().toISO();
    
    return { start: start!, end: end! };
  }
  
  return null;
}
