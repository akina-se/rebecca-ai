import { checkAndIncrementRateLimits } from '../../src/core/rateLimiter';
import { getJSTDate } from '../../src/utils/time';
import { createMockDeps } from './core/testUtils';

jest.mock('../../src/utils/time');
jest.mock('../../src/config', () => ({
    __esModule: true,
    default: {
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
        // Fixed date for testing: 2024-01-01T12:30:00Z (JST)
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T12:30:00Z'));
    });

    it('should allow request when under all limits (normal case)', async () => {
        deps.firestore.checkAndConsumeRateLimit.mockResolvedValueOnce({ allowed: true });

        const result = await checkAndIncrementRateLimits(deps, 'user1');
        
        expect(result).toEqual({ allowed: true });
        expect(deps.firestore.checkAndConsumeRateLimit).toHaveBeenCalledWith(
            'user1',
            expect.any(String),
            expect.any(String),
            expect.any(String),
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
});
