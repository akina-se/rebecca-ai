import { AppDependencies } from '../types';
import config from '../config';
import { getZonedDateParts } from '../utils/time';

/**
 * Generates rate limit time window keys (daily, monthly, per-minute)
 * localized to the application configured time zone.
 *
 * @param date - Optional date instance (defaults to current time).
 * @param timezone - Optional target time zone (defaults to config.appTimezone).
 * @returns Object containing dateStr, monthStr, and minuteStr.
 */
export const getRateLimitTimeKeys = (
  date: Date = new Date(),
  timezone: string = config.appTimezone,
): { dateStr: string; monthStr: string; minuteStr: string } => {
  const { year, month, day, hour, minute } = getZonedDateParts(date, timezone);
  return {
    dateStr: `${year}-${month}-${day}`,
    monthStr: `${year}-${month}`,
    minuteStr: `${year}-${month}-${day}T${hour}:${minute}`,
  };
};

/**
 * Checks if a user is within acceptable rate limits and increments their usage counters if allowed.
 * Uses atomic transactions to prevent race conditions and efficiently maintain dynamic DAU-based limits.
 * 
 * @param deps - The application dependencies including the firestore service.
 * @param userId - The ID of the user.
 * @returns A promise resolving to an object indicating if the request is allowed and an optional reason if denied.
 */
const checkAndIncrementRateLimits = async (deps: AppDependencies, userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    const { dateStr, monthStr, minuteStr } = getRateLimitTimeKeys();

    const globalDailyLimit = config.limits.globalDailyLimit || 45;
    const spamMinuteLimit = config.limits.spamMinuteLimit || 3;

    return deps.firestore.checkAndConsumeRateLimit(
        userId,
        dateStr,
        monthStr,
        minuteStr,
        { globalDaily: globalDailyLimit, spamMinute: spamMinuteLimit }
    );
};

export { 
    checkAndIncrementRateLimits
};

