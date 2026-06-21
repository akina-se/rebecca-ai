const firestore = require('../services/firestore');
const config = require('../config');
const { getJSTDate } = require('../utils/time');

const getJSTDateString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getJSTMonthString = () => {
    const d = getJSTDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const checkAndIncrementRateLimits = async (userId) => {
    const dateStr = getJSTDateString();
    const monthStr = getJSTMonthString();

    const globalDailyLimit = config.limits.phase1?.globalDailyLimit || 140;

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
    
    return { allowed: true };
};

module.exports = {
    checkAndIncrementRateLimits
};
