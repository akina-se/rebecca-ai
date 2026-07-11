import * as firestore from '../services/firestore';
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
 * 
 * @param userId - The ID of the user.
 * @returns A promise resolving to an object indicating if the request is allowed and an optional reason if denied.
 */
const checkAndIncrementRateLimits = async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    const dateStr = getJSTDateString();
    const monthStr = getJSTMonthString();
    const minuteStr = getJSTMinuteString();

    const globalDailyLimit = config.limits.globalDailyLimit || 45;
    const spamMinuteLimit = config.limits.spamMinuteLimit || 3;

    const userMinute = await firestore.getUserMinuteLimit(userId, minuteStr);
    if (userMinute >= spamMinuteLimit) {
        return { allowed: false, reason: 'user_minute_spam' };
    }

    const globalDaily = await firestore.getGlobalRateLimit('daily', dateStr);
    if (globalDaily >= globalDailyLimit) {
        return { allowed: false, reason: 'global_daily' };
    }

    const userDaily = await firestore.getUserDailyLimit(userId, dateStr);
    const dau = await firestore.getDailyActiveUsersCount(dateStr);
    
    let dynamicUserLimit = Math.floor(globalDailyLimit / dau);
    if (dynamicUserLimit < 3) dynamicUserLimit = 3;

    if (userDaily >= dynamicUserLimit) {
        return { allowed: false, reason: 'user_daily' };
    }

    await firestore.incrementGlobalRateLimit('monthly', monthStr);
    await firestore.incrementGlobalRateLimit('daily', dateStr);
    await firestore.incrementUserDailyLimit(userId, dateStr);
    await firestore.incrementUserMinuteLimit(userId, minuteStr);
    
    return { allowed: true };
};

export { 
    checkAndIncrementRateLimits
 };
