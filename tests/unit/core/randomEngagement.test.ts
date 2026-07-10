import * as xApi from '../../../src/services/xApi';
import * as firestore from '../../../src/services/firestore';
import * as gemini from '../../../src/services/gemini';
import { runRandomEngagementBatch } from '../../../src/core/randomEngagement';
import { checkAndIncrementRateLimits } from '../../../src/core/rateLimiter';

jest.mock('../../../src/services/xApi');
jest.mock('../../../src/services/firestore');
jest.mock('../../../src/services/gemini');
jest.mock('../../../src/core/rateLimiter');
jest.mock('../../../src/config', () => ({
  __esModule: true,
  default: {
    gcp: { projectId: 'test' },
    xApi: { targetListId: 'list_abc' },
    limits: {}
  }
}));

describe('Random Engagement Batch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should engage with a random eligible user', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({
            data: [
                { id: 'user1', username: 'already_engaged' },
                { id: 'user2', username: 'target_user' }
            ]
        });

        (firestore.getLastListInteraction as jest.Mock).mockImplementation(async (id) => {
            return id === 'user1' ? new Date() : null;
        });

        (checkAndIncrementRateLimits as jest.Mock).mockResolvedValue({ allowed: true });

        (xApi.getUserProfile as jest.Mock).mockResolvedValue({
            data: { description: 'I love games.' }
        });

        (gemini.analyzeUserProfile as jest.Mock).mockResolvedValue({ attributes: [], preferences: ['games'] });
        (gemini.detectLanguage as jest.Mock).mockResolvedValue('ja');
        (gemini.generateReply as jest.Mock).mockResolvedValue('Hey @target_user, playing games again?');

        const result = await runRandomEngagementBatch();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBe('target_user');
        
        expect(xApi.tweet).toHaveBeenCalledWith('Hey @target_user, playing games again?');
        expect(firestore.updateLastListInteraction).toHaveBeenCalledWith('user2');
    });

    it('should skip if all users have already been engaged', async () => {
        (xApi.getListMembers as jest.Mock).mockResolvedValue({
            data: [
                { id: 'user1', username: 'user1' },
                { id: 'user2', username: 'user2' }
            ]
        });

        (firestore.getLastListInteraction as jest.Mock).mockResolvedValue(new Date()); // All engaged

        const result = await runRandomEngagementBatch();

        expect(result.status).toBe('success');
        expect(result.processedUser).toBeUndefined();
        expect(xApi.tweet).not.toHaveBeenCalled();
    });
});
