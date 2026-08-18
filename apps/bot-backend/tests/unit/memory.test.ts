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
                expect(deps.firestore.updateCoreProfile).toHaveBeenCalledWith('user1', { attributes: ['cool'] });
            });

            it('should catch and log error if generateDreaming fails (abnormal case)', async () => {
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
                deps.gemini.generateDreaming.mockRejectedValueOnce(new Error('API Error'));
                
                await (useCase as any).processDreamingForUser('user1', { episodicBuffer: [{ role: 'user', content: 'hi' }] } as unknown as any);
                
                expect(deps.firestore.updateCoreProfile).not.toHaveBeenCalled();
                expect(consoleSpy).toHaveBeenCalledWith('Dreaming failed for user: user1', expect.any(Error));
                
                consoleSpy.mockRestore();
            });
        });

        describe('execute', () => {
            it('should process all users and update timeline summary if there are recent posts', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([
                    { id: 'u1', episodicBuffer: [{}] },
                    { id: 'u2', episodicBuffer: [] } // will skip dreaming
                ]);
                deps.firestore.getRecentTimelinePosts.mockResolvedValue(['post1', 'post2']);
                deps.firestore.getTimelineSummary.mockResolvedValue('old_summary');
                deps.gemini.generateTimelineSummary.mockResolvedValue('new_summary');
                
                deps.gemini.generateDreaming.mockResolvedValue({});

                await useCase.execute();

                expect(deps.firestore.getAllUsers).toHaveBeenCalled();
                expect(deps.gemini.generateTimelineSummary).toHaveBeenCalledWith(expect.stringContaining('old_summary'));
                expect(deps.firestore.saveTimelineSummary).toHaveBeenCalledWith('new_summary');
            });

            it('should skip timeline summary if no recent posts', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([]);
                deps.firestore.getRecentTimelinePosts.mockResolvedValue([]);

                await useCase.execute();

                expect(deps.gemini.generateTimelineSummary).not.toHaveBeenCalled();
                expect(deps.firestore.saveTimelineSummary).not.toHaveBeenCalled();
            });

            it('should catch error if timeline summary fails', async () => {
                deps.firestore.getAllUsers.mockResolvedValue([]);
                deps.firestore.getRecentTimelinePosts.mockRejectedValue(new Error('Timeline fetch error'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

                await useCase.execute();

                expect(consoleSpy).toHaveBeenCalledWith("Failed to summarize timeline", expect.any(Error));
                consoleSpy.mockRestore();
            });
        });
    });
});
