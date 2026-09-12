import { checkAndIncrementRateLimits, getRateLimitTimeKeys } from '../../src/core/rateLimiter';
import { getZonedDateParts } from '../../src/utils/time';
import { createMockDeps } from './core/testUtils';

jest.mock('../../src/utils/time', () => ({
    getZonedDateParts: jest.fn(),
}));
jest.mock('../../src/config', () => ({
    __esModule: true,
    default: {
        appTimezone: 'Asia/Tokyo',
        limits: {
            globalDailyLimit: 45,
            spamMinuteLimit: 3
        },
        gcp: {
            projectId: 'test-project'
        }
    }
}));

describe('rateLimiter.ts', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
        (getZonedDateParts as jest.Mock).mockReturnValue({
            year: '2024',
            month: '01',
            day: '01',
            hour: '12',
            minute: '30',
            second: '00',
            numericYear: 2024,
            numericMonth: 1,
            numericDay: 1,
            numericHour: 12,
            numericMinute: 30,
        });
    });

    it('should generate formatted rate limit time keys from getZonedDateParts', () => {
        const keys = getRateLimitTimeKeys();
        expect(keys.dateStr).toBe('2024-01-01');
        expect(keys.monthStr).toBe('2024-01');
        expect(keys.minuteStr).toBe('2024-01-01T12:30');
    });

    it('should allow request when under all limits (normal case)', async () => {
        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: true });

        const result = await checkAndIncrementRateLimits(deps, 'user1');
        
        expect(result).toEqual({ allowed: true });
        expect(deps.firestore.checkAndConsumeRateLimit).toHaveBeenCalledWith(
            'user1',
            '2024-01-01',
            '2024-01',
            '2024-01-01T12:30',
            { globalDaily: 45, spamMinute: 3 }
        );
    });


    it('should block if user minute limit is exceeded (boundary case)', async () => {
        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: false, reason: 'user_minute_spam' });
        
        const result = await checkAndIncrementRateLimits(deps, 'user1');
        
        expect(result).toEqual({ allowed: false, reason: 'user_minute_spam' });
    });

    it('should block if global daily limit is exceeded (boundary case)', async () => {
        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: false, reason: 'global_daily' });
        
        const result = await checkAndIncrementRateLimits(deps, 'user1');
        
        expect(result).toEqual({ allowed: false, reason: 'global_daily' });
    });

    it('should block if dynamic user daily limit is exceeded (boundary case)', async () => {
        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: false, reason: 'user_daily' });
        
        const result = await checkAndIncrementRateLimits(deps, 'user1');
        
        expect(result).toEqual({ allowed: false, reason: 'user_daily' });
    });

    it('should use default fallback limits when config values are not set', async () => {
        const config = require('../../src/config').default;
        const originalGlobal = config.limits.globalDailyLimit;
        const originalSpam = config.limits.spamMinuteLimit;

        delete config.limits.globalDailyLimit;
        delete config.limits.spamMinuteLimit;

        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: true });
        await checkAndIncrementRateLimits(deps, 'user_fallback');

        expect(deps.firestore.checkAndConsumeRateLimit).toHaveBeenCalledWith(
            'user_fallback',
            expect.any(String),
            expect.any(String),
            expect.any(String),
            { globalDaily: 45, spamMinute: 3 }
        );

        config.limits.globalDailyLimit = originalGlobal;
        config.limits.spamMinuteLimit = originalSpam;
    });
});
