import * as firestore from '../services/firestore';
import config from '../config';
import { getJSTDate  } from '../utils/time';

const getJSTDateString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getJSTMonthString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getJSTMinuteString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const checkAndIncrementRateLimits = async (userId) => {
    const dateStr = getJSTDateString();
    const monthStr = getJSTMonthString();
    const minuteStr = getJSTMinuteString();

    const globalDailyLimit = config.limits.globalDailyLimit || 45;
    const spamMinuteLimit = config.limits.spamMinuteLimit || 3;

    // 1. User Minute (Spam check)
    const userMinute = await firestore.getUserMinuteLimit(userId, minuteStr);
    if (userMinute >= spamMinuteLimit) {
        return { allowed: false, reason: 'user_minute_spam' };
    }

    // 2. Global Daily
    const globalDaily = await firestore.getGlobalRateLimit('daily', dateStr);
    if (globalDaily >= globalDailyLimit) {
        return { allowed: false, reason: 'global_daily' };
    }

    // 3. User Daily (Dynamic)
    const userDaily = await firestore.getUserDailyLimit(userId, dateStr);
    const dau = await firestore.getDailyActiveUsersCount(dateStr);
    
    // Dynamic allocation logic: Total global daily limit / DAU (with a fallback min limit)
    let dynamicUserLimit = Math.floor(globalDailyLimit / dau);
    if (dynamicUserLimit < 3) dynamicUserLimit = 3; // Ensure at least some replies

    if (userDaily >= dynamicUserLimit) {
        return { allowed: false, reason: 'user_daily' };
    }

    // Pass: increment all
    await firestore.incrementGlobalRateLimit('monthly', monthStr);
    await firestore.incrementGlobalRateLimit('daily', dateStr);
    await firestore.incrementUserDailyLimit(userId, dateStr);
    await firestore.incrementUserMinuteLimit(userId, minuteStr);
    
    return { allowed: true };
};

export { 
    checkAndIncrementRateLimits
 };
