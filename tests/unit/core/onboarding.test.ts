import * as xApi from '../../../src/services/xApi';
import * as firestore from '../../../src/services/firestore';
import { runStealthOnboardingBatch } from '../../../src/core/onboarding';

jest.mock('../../../src/services/xApi');
jest.mock('../../../src/services/firestore');
jest.mock('../../../src/config', () => ({
  __esModule: true,
  default: {
    gcp: { projectId: 'test' },
    xApi: {
      myUserId: '123',
      targetListId: 'list_abc'
    },
    limits: {}
  }
}));

describe('Stealth Onboarding Batch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch followers and add new ones to the target list', async () => {
        // Setup mock data
        (xApi.getFollowers as jest.Mock).mockResolvedValue({
            data: [
                { id: 'user1', username: 'john' },
                { id: 'user2', username: 'jane' } // user2 already processed
            ]
        });

        (firestore.hasProcessedFollower as jest.Mock).mockImplementation(async (id) => {
            return id === 'user2';
        });

        (xApi.addListMember as jest.Mock).mockResolvedValue(true);

        // Execute
        const result = await runStealthOnboardingBatch();

        // Verify
        expect(result.status).toBe('success');
        expect(result.processed).toBe(1);

        expect(firestore.hasProcessedFollower).toHaveBeenCalledTimes(2);
        
        // user1 should be added and marked
        expect(xApi.addListMember).toHaveBeenCalledWith('list_abc', 'user1');
        expect(firestore.markFollowerProcessed).toHaveBeenCalledWith('user1');
        
        // user2 should be skipped
        expect(xApi.addListMember).not.toHaveBeenCalledWith('list_abc', 'user2');
        expect(firestore.markFollowerProcessed).not.toHaveBeenCalledWith('user2');
    });

    it('should return successfully with 0 processed if there are no followers', async () => {
        (xApi.getFollowers as jest.Mock).mockResolvedValue({ data: [] });

        const result = await runStealthOnboardingBatch();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(0);
        expect(xApi.addListMember).not.toHaveBeenCalled();
    });
    it('should return failed if myUserId is not set', async () => {
        const originalId = require('../../../src/config').default.xApi.myUserId;
        require('../../../src/config').default.xApi.myUserId = '';
        const result = await runStealthOnboardingBatch();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.myUserId = originalId;
    });

    it('should return failed if targetListId is not set', async () => {
        const originalList = require('../../../src/config').default.xApi.targetListId;
        require('../../../src/config').default.xApi.targetListId = '';
        const result = await runStealthOnboardingBatch();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.targetListId = originalList;
    });

    it('should not mark follower as processed if addListMember fails', async () => {
        (xApi.getFollowers as jest.Mock).mockResolvedValue({ data: [{ id: 'user3', username: 'smith' }] });
        (firestore.hasProcessedFollower as jest.Mock).mockResolvedValue(false);
        (xApi.addListMember as jest.Mock).mockResolvedValue(false); // fails!

        const result = await runStealthOnboardingBatch();

        expect(result.processed).toBe(0);
        expect(firestore.markFollowerProcessed).not.toHaveBeenCalled();
    });

    it('should throw error if underlying api throws', async () => {
        (xApi.getFollowers as jest.Mock).mockRejectedValue(new Error('api error'));
        await expect(runStealthOnboardingBatch()).rejects.toThrow('api error');
    });
});
