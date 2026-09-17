import { getWorkingMemory, saveInteraction } from '../../src/core/memory';
import { GlobalDreamingUseCase } from '../../src/features/dreaming/usecase';
import { createMockDeps } from './core/testUtils';

describe('Memory Module', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
    });

    describe('getWorkingMemory', () => {
        it('should return empty array if episodicBuffer is missing or empty (boundary case)', () => {
            expect(getWorkingMemory(undefined as any)).toEqual([]);
            expect(getWorkingMemory([])).toEqual([]);
        });

        it('should correctly slice the last N pairs (normal case)', () => {
            const buffer = Array.from({ length: 30 }).map((_, i) => ({ role: (i % 2 === 0 ? 'user' : 'model') as 'user' | 'model', content: `msg${i}` }));
            // limit = 10, should return last 20 elements
            const result = getWorkingMemory(buffer, 10);
            expect(result.length).toBe(20);
            expect(result[0].content).toBe('msg10');
            expect(result[19].content).toBe('msg29');
        });
    });

    describe('saveInteraction', () => {
        it('should append user and model interactions with timestamps', async () => {
            const mockDate = new Date('2024-01-01T00:00:00Z');
            jest.useFakeTimers().setSystemTime(mockDate);

            await saveInteraction(deps, 'user1', 'Hello', 'Hi there');

            expect(deps.firestore.appendEpisodicBuffer).toHaveBeenCalledTimes(2);
            expect(deps.firestore.appendEpisodicBuffer).toHaveBeenNthCalledWith(1, 'user1', {
                role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00.000Z'
            });
            expect(deps.firestore.appendEpisodicBuffer).toHaveBeenNthCalledWith(2, 'user1', {
                role: 'model', content: 'Hi there', timestamp: '2024-01-01T00:00:00.000Z'
            });

            jest.useRealTimers();
        });
    });

    describe('GlobalDreamingUseCase', () => {
        let useCase: GlobalDreamingUseCase;

        beforeEach(() => {
            useCase = new GlobalDreamingUseCase(deps);
        });

        describe('processDreamingForUser', () => {
            it('should return early if episodic buffer is empty (boundary case)', async () => {
                await (useCase as any).processDreamingForUser('user1', { episodicBuffer: [] } as unknown as any);
                expect(deps.gemini.generateDreaming).not.toHaveBeenCalled();
            });

            it('should generate and update core profile (normal case)', async () => {
                deps.gemini.generateDreaming.mockResolvedValueOnce({ attributes: ['cool'] });
                
                await (useCase as any).processDreamingForUser('user1', { episodicBuffer: [{ role: 'user', content: 'hi' }] } as unknown as any);
                
                expect(deps.gemini.generateDreaming).toHaveBeenCalled();
                expect(deps.firestore.updateCoreProfile).toHaveBeenCalledWith('user1', { attributes: ['cool'] }, [{ role: 'user', content: 'hi' }]);
            });

            it('should catch and log error if generateDreaming fails (abnormal case)', async () => {
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
                deps.gemini.generateDreaming.mockRejectedValueOnce(new Error('API Error'));
                
                await (useCase as any).processDreamingForUser('user1', { episodicBuffer: [{ role: 'user', content: 'hi' }] } as unknown as any);
                
                expect(deps.firestore.updateCoreProfile).not.toHaveBeenCalled();
                expect(consoleSpy).toHaveBeenCalledWith('[GlobalDreamingUseCase] Dreaming failed for user: user1:', expect.any(Error));
                
                consoleSpy.mockRestore();
            });
        });

        describe('execute', () => {
            it('should consolidate users with pending buffers and skip users with empty buffers', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([
                    { id: 'u1', episodicBuffer: [{ role: 'user', content: 'hello' }] },
                    { id: 'u2', episodicBuffer: [] } // will skip dreaming
                ]);
                deps.gemini.generateDreaming.mockResolvedValue({ attributes: ['friendly'] });

                const customUseCase = new GlobalDreamingUseCase(deps, { throttleMs: 5 });
                const result = await customUseCase.execute();

                expect(deps.firestore.getAllUsers).toHaveBeenCalled();
                expect(deps.gemini.generateDreaming).toHaveBeenCalledTimes(1);
                expect(deps.firestore.updateCoreProfile).toHaveBeenCalledWith(
                    'u1',
                    { attributes: ['friendly'] },
                    expect.any(Array),
                );
                expect(result).toEqual({
                    status: 'success',
                    totalUsers: 2,
                    processedUsers: 1,
                    succeeded: 1,
                    failed: 0,
                    skipped: 1,
                });
            });

            it('should return skipped status if no users have pending episodic buffers', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([
                    { id: 'u1', episodicBuffer: [] },
                    { id: 'u2' }
                ]);

                const result = await useCase.execute();

                expect(result.status).toBe('skipped');
                expect(result.reason).toBe('no_users_with_episodic_buffer');
                expect(deps.gemini.generateDreaming).not.toHaveBeenCalled();
            });

            it('should isolate failures per user and report partial_success when some succeed and some fail', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([
                    { id: 'u1', episodicBuffer: [{ role: 'user', content: 'hi' }] },
                    { id: 'u2', episodicBuffer: [{ role: 'user', content: 'fail' }] },
                ]);

                deps.gemini.generateDreaming
                    .mockResolvedValueOnce({ attributes: ['good'] })
                    .mockRejectedValueOnce(new Error('User 2 rate limit'));

                const customUseCase = new GlobalDreamingUseCase(deps, { throttleMs: 1 });
                const result = await customUseCase.execute();

                expect(result.status).toBe('partial_success');
                expect(result.processedUsers).toBe(2);
                expect(result.succeeded).toBe(1);
                expect(result.failed).toBe(1);
                expect(deps.firestore.updateCoreProfile).toHaveBeenCalledTimes(1);
                expect(deps.firestore.updateCoreProfile).toHaveBeenCalledWith('u1', expect.any(Object), expect.any(Array));
            });

            it('should report failed status when all target users fail', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([
                    { id: 'u1', episodicBuffer: [{ role: 'user', content: 'hi' }] },
                ]);
                deps.gemini.generateDreaming.mockRejectedValueOnce(new Error('API quota'));

                const customUseCase = new GlobalDreamingUseCase(deps, { throttleMs: 1 });
                const result = await customUseCase.execute();

                expect(result.status).toBe('failed');
                expect(result.succeeded).toBe(0);
                expect(result.failed).toBe(1);
            });
        });
    });
});
