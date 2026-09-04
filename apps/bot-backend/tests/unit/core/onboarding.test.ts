import { StealthOnboardingUseCase } from '../../../src/features/onboarding/usecase';
import { createMockDeps } from './testUtils';

// We can still mock config globally since it's not DI'ed yet

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
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
    });

    it('should fetch followers and add new ones to the target list', async () => {
        // Setup mock data
        deps.xApi.getFollowers.mockResolvedValue({
            data: [
                { id: 'user1', username: 'john' },
                { id: 'user2', username: 'jane' } // user2 already processed
            ]
        });

        deps.firestore.hasProcessedFollower.mockImplementation(async (id: string) => {
            return id === 'user2';
        });

        deps.xApi.addListMember.mockResolvedValue(true);

        // Execute
        const result = await new StealthOnboardingUseCase(deps).execute();

        // Verify
        expect(result.status).toBe('success');
        expect(result.processed).toBe(1);

        expect(deps.firestore.hasProcessedFollower).toHaveBeenCalledTimes(2);
        
        // user1 should be added and marked
        expect(deps.xApi.addListMember).toHaveBeenCalledWith('list_abc', 'user1');
        expect(deps.firestore.markFollowerProcessed).toHaveBeenCalledWith('user1');
        
        // user2 should be skipped
        expect(deps.xApi.addListMember).not.toHaveBeenCalledWith('list_abc', 'user2');
        expect(deps.firestore.markFollowerProcessed).not.toHaveBeenCalledWith('user2');
    });

    it('should skip adding follower to list if follower is blocked by admin', async () => {
        deps.xApi.getFollowers.mockResolvedValue({
            data: [
                { id: 'blocked_user', username: 'badactor' }
            ]
        });
        deps.firestore.hasProcessedFollower.mockResolvedValue(false);
        deps.firestore.getUserDoc.mockResolvedValue({ status: 'BLOCKED' });

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(0);
        expect(deps.xApi.addListMember).not.toHaveBeenCalled();
        expect(deps.firestore.markFollowerProcessed).toHaveBeenCalledWith('blocked_user');
    });

    it('should return successfully with 0 processed if there are no followers', async () => {
        deps.xApi.getFollowers.mockResolvedValue({ data: [] });

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(0);
        expect(deps.xApi.addListMember).not.toHaveBeenCalled();
    });
    it('should return failed if myUserId is not set', async () => {
        const originalId = require('../../../src/config').default.xApi.myUserId;
        require('../../../src/config').default.xApi.myUserId = '';
        deps.xApi.cachedNumericMyUserId = undefined;
        const result = await new StealthOnboardingUseCase(deps).execute();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.myUserId = originalId;
    });

    it('should return failed if targetListId is not set', async () => {
        const originalList = require('../../../src/config').default.xApi.targetListId;
        require('../../../src/config').default.xApi.targetListId = '';
        const result = await new StealthOnboardingUseCase(deps).execute();
        expect(result.status).toBe('failed');
        require('../../../src/config').default.xApi.targetListId = originalList;
    });

    it('should not mark follower as processed if addListMember fails', async () => {
        deps.xApi.getFollowers.mockResolvedValue({ data: [{ id: 'user3', username: 'smith' }] });
        deps.firestore.hasProcessedFollower.mockResolvedValue(false);
        deps.xApi.addListMember.mockResolvedValue(false); // fails!

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.processed).toBe(0);
        expect(deps.firestore.markFollowerProcessed).not.toHaveBeenCalled();
    });

    it('should paginate with nextToken, skip processed followers in mixed batch, and stop when an entire batch is already processed', async () => {
        // Page 1: 1 new user, 1 already processed user -> batch has new user, proceeds with next_token
        deps.xApi.getFollowers.mockResolvedValueOnce({
            data: [
                { id: 'user_p1_old', username: 'p1_old' },
                { id: 'user_p1_new', username: 'p1_new' }
            ],
            meta: { next_token: 'next_page_token' }
        });
        // Page 2: 2 already processed users -> batch has NO new user, stops pagination!
        deps.xApi.getFollowers.mockResolvedValueOnce({
            data: [
                { id: 'user_p2_old1', username: 'p2_old1' },
                { id: 'user_p2_old2', username: 'p2_old2' }
            ],
            meta: { next_token: 'should_not_reach_token' }
        });

        deps.firestore.hasProcessedFollower.mockImplementation(async (id: string) => {
            return id !== 'user_p1_new';
        });
        deps.xApi.addListMember.mockResolvedValue(true);
        deps.firestore.getProcessedFollowersCount.mockResolvedValue(10);

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(1); // only user_p1_new
        expect(deps.xApi.getFollowers).toHaveBeenCalledTimes(2);
        expect(deps.xApi.addListMember).toHaveBeenCalledWith('list_abc', 'user_p1_new');
        expect(deps.firestore.markFollowerProcessed).toHaveBeenCalledWith('user_p1_new');
        expect(deps.firestore.updateTotalFollowers).toHaveBeenCalledWith(10);
    });

    it('should not abort batch when addListMember throws an error for a user', async () => {
        deps.xApi.getFollowers.mockResolvedValueOnce({
            data: [
                { id: 'user_err', username: 'err_user' },
                { id: 'user_ok', username: 'ok_user' }
            ]
        });

        deps.firestore.hasProcessedFollower.mockResolvedValue(false);
        deps.xApi.addListMember.mockImplementation(async (_listId: string, userId: string) => {
            if (userId === 'user_err') {
                throw new Error('403 Forbidden: You are not allowed to add members to this List.');
            }
            return true;
        });

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(1); // user_ok succeeded
        expect(deps.firestore.markFollowerProcessed).not.toHaveBeenCalledWith('user_err');
        expect(deps.firestore.markFollowerProcessed).toHaveBeenCalledWith('user_ok');
    });

    it('should enforce hard limit when total fetched followers reach maxResults', async () => {
        // Mock 10 followers per page
        const page1Data = Array.from({ length: 10 }, (_, i) => ({ id: `user_p1_${i}`, username: `p1_${i}` }));
        const page2Data = Array.from({ length: 10 }, (_, i) => ({ id: `user_p2_${i}`, username: `p2_${i}` }));

        deps.xApi.getFollowers.mockResolvedValueOnce({ data: page1Data, meta: { next_token: 'token_2' } });
        deps.xApi.getFollowers.mockResolvedValueOnce({ data: page2Data, meta: { next_token: 'token_3' } });

        // Overwrite maxResults temporarily to 15 for test
        const originalMax = require('../../../src/config').default.xApi.followersMaxResults;
        const originalPage = require('../../../src/config').default.xApi.followersPageSize;
        require('../../../src/config').default.xApi.followersMaxResults = 15;
        require('../../../src/config').default.xApi.followersPageSize = 10;

        deps.firestore.hasProcessedFollower.mockResolvedValue(false);
        deps.xApi.addListMember.mockResolvedValue(true);

        const result = await new StealthOnboardingUseCase(deps).execute();

        expect(result.status).toBe('success');
        expect(result.processed).toBe(15); // stopped at 15 exactly
        expect(deps.xApi.getFollowers).toHaveBeenCalledTimes(2);

        require('../../../src/config').default.xApi.followersMaxResults = originalMax;
        require('../../../src/config').default.xApi.followersPageSize = originalPage;
    });

    it('should throw error if underlying api throws', async () => {
        deps.xApi.getFollowers.mockRejectedValue(new Error('api error'));
        await expect(new StealthOnboardingUseCase(deps).execute()).rejects.toThrow('api error');
    });
});
