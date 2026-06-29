import { checkAndIncrementRateLimits } from '../../src/core/rateLimiter';
import * as firestore from '../../src/services/firestore';
import { getJSTDate } from '../../src/utils/time';

jest.mock('../../src/services/firestore');
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
    beforeEach(() => {
        jest.clearAllMocks();
        // Fixed date for testing: 2024-01-01T12:30:00Z (JST)
        (getJSTDate as jest.Mock).mockReturnValue(new Date('2024-01-01T12:30:00Z'));
    });

    it('should allow request when under all limits (normal case)', async () => {
        (firestore.getUserMinuteLimit as jest.Mock).mockResolvedValueOnce(0);
        (firestore.getGlobalRateLimit as jest.Mock).mockResolvedValueOnce(10);
        (firestore.getUserDailyLimit as jest.Mock).mockResolvedValueOnce(2);
        (firestore.getDailyActiveUsersCount as jest.Mock).mockResolvedValueOnce(5);
        // Dynamic limit = floor(45 / 5) = 9
        // userDaily(2) < 9 => allowed

        const result = await checkAndIncrementRateLimits('user1');
        
        expect(result).toEqual({ allowed: true });
        expect(firestore.incrementGlobalRateLimit).toHaveBeenCalledTimes(2); // daily and monthly
        expect(firestore.incrementUserDailyLimit).toHaveBeenCalled();
        expect(firestore.incrementUserMinuteLimit).toHaveBeenCalled();
    });

    it('should block if user minute limit is exceeded (boundary case)', async () => {
        (firestore.getUserMinuteLimit as jest.Mock).mockResolvedValueOnce(3); // spamMinuteLimit is 3
        
        const result = await checkAndIncrementRateLimits('user1');
        
        expect(result).toEqual({ allowed: false, reason: 'user_minute_spam' });
        expect(firestore.incrementGlobalRateLimit).not.toHaveBeenCalled();
    });

    it('should block if global daily limit is exceeded (boundary case)', async () => {
        (firestore.getUserMinuteLimit as jest.Mock).mockResolvedValueOnce(0);
        (firestore.getGlobalRateLimit as jest.Mock).mockResolvedValueOnce(45); // globalDailyLimit is 45
        
        const result = await checkAndIncrementRateLimits('user1');
        
        expect(result).toEqual({ allowed: false, reason: 'global_daily' });
    });

    it('should block if dynamic user daily limit is exceeded (boundary case)', async () => {
        (firestore.getUserMinuteLimit as jest.Mock).mockResolvedValueOnce(0);
        (firestore.getGlobalRateLimit as jest.Mock).mockResolvedValueOnce(10);
        
        // 45 / 15 DAU = 3 per user.
        (firestore.getDailyActiveUsersCount as jest.Mock).mockResolvedValueOnce(15);
        (firestore.getUserDailyLimit as jest.Mock).mockResolvedValueOnce(3); // exactly dynamic limit
        
        const result = await checkAndIncrementRateLimits('user1');
        
        expect(result).toEqual({ allowed: false, reason: 'user_daily' });
    });

    it('should ensure dynamic limit has a fallback minimum of 3', async () => {
        (firestore.getUserMinuteLimit as jest.Mock).mockResolvedValueOnce(0);
        (firestore.getGlobalRateLimit as jest.Mock).mockResolvedValueOnce(10);
        
        // 45 / 45 DAU = 1 per user. But fallback is 3.
        (firestore.getDailyActiveUsersCount as jest.Mock).mockResolvedValueOnce(45);
        (firestore.getUserDailyLimit as jest.Mock).mockResolvedValueOnce(2); // under 3
        
        const result = await checkAndIncrementRateLimits('user1');
        
        expect(result).toEqual({ allowed: true });
    });
});
