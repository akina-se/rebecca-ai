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

    it('should throw error if underlying api throws', async () => {
        deps.xApi.getFollowers.mockRejectedValue(new Error('api error'));
        await expect(new StealthOnboardingUseCase(deps).execute()).rejects.toThrow('api error');
    });
});
