import { AppDependencies } from '../types';
import config from '../config';
import { getJSTDate  } from '../utils/time';

/**
 * Retrieves the current JST date formatted as a string (YYYY-MM-DD).
 * 
 * @returns The formatted date string.
 */
const getJSTDateString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Retrieves the current JST month formatted as a string (YYYY-MM).
 * 
 * @returns The formatted month string.
 */
const getJSTMonthString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Retrieves the current JST minute formatted as a string (YYYY-MM-DDTHH:mm).
 * 
 * @returns The formatted minute string.
 */
const getJSTMinuteString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    const dateStr = getJSTDateString();
    const monthStr = getJSTMonthString();
    const minuteStr = getJSTMinuteString();

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
