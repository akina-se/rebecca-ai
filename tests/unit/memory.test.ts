import { getWorkingMemory, saveInteraction, runGlobalDreamingBatch, processDreamingForUser } from '../../src/core/memory';
import * as firestore from '../../src/services/firestore';
import * as gemini from '../../src/services/gemini';

jest.mock('../../src/services/firestore');
jest.mock('../../src/services/gemini');

describe('memory.ts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getWorkingMemory', () => {
        it('should return empty array if episodicBuffer is missing or empty (boundary case)', () => {
            expect(getWorkingMemory(undefined)).toEqual([]);
            expect(getWorkingMemory([])).toEqual([]);
        });

        it('should correctly slice the last N pairs (normal case)', () => {
            const buffer = Array.from({ length: 30 }).map((_, i) => ({ role: i % 2 === 0 ? 'user' : 'model', content: `msg${i}` }));
            // limit = 10, should return last 20 elements
            const result = getWorkingMemory(buffer, 10);
            expect(result.length).toBe(20);
            expect(result[0].content).toBe('msg10');
            expect(result[19].content).toBe('msg29');
        });
    });

    describe('saveInteraction', () => {
        it('should save user and model interactions (normal case)', async () => {
            await saveInteraction('user1', 'hi', 'hello');
            expect(firestore.appendEpisodicBuffer).toHaveBeenCalledTimes(2);
            
            const firstCall = (firestore.appendEpisodicBuffer as jest.Mock).mock.calls[0];
            expect(firstCall[0]).toBe('user1');
            expect(firstCall[1].role).toBe('user');
            expect(firstCall[1].content).toBe('hi');

            const secondCall = (firestore.appendEpisodicBuffer as jest.Mock).mock.calls[1];
            expect(secondCall[1].role).toBe('model');
            expect(secondCall[1].content).toBe('hello');
        });
    });

    describe('processDreamingForUser', () => {
        it('should return early if episodic buffer is empty (boundary case)', async () => {
            await processDreamingForUser('user1', { episodicBuffer: [] });
            expect(gemini.generateDreaming).not.toHaveBeenCalled();
        });

        it('should generate and update core profile (normal case)', async () => {
            (gemini.generateDreaming as jest.Mock).mockResolvedValueOnce({ attributes: ['cool'] });
            
            await processDreamingForUser('user1', { episodicBuffer: [{ role: 'user', content: 'hi' }] });
            
            expect(gemini.generateDreaming).toHaveBeenCalled();
            expect(firestore.updateCoreProfile).toHaveBeenCalledWith('user1', { attributes: ['cool'] });
        });

        it('should catch and log error if generateDreaming fails (abnormal case)', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (gemini.generateDreaming as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
            
            await processDreamingForUser('user1', { episodicBuffer: [{ role: 'user', content: 'hi' }] });
            
            expect(firestore.updateCoreProfile).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('Dreaming failed for user: user1', expect.any(Error));
            
            consoleSpy.mockRestore();
        });
    });

    describe('runGlobalDreamingBatch', () => {
        it('should process all users and update timeline (normal case)', async () => {
            (firestore.getAllUsers as jest.Mock).mockResolvedValueOnce([
                { id: 'user1', episodicBuffer: [{}] }
            ]);
            (firestore.getRecentTimelinePosts as jest.Mock).mockResolvedValueOnce(['post1']);
            (firestore.getTimelineSummary as jest.Mock).mockResolvedValueOnce('old summary');
            (gemini.generateTimelineSummary as jest.Mock).mockResolvedValueOnce('new summary');
            (gemini.generateDreaming as jest.Mock).mockResolvedValueOnce({ attributes: [] });
            
            await runGlobalDreamingBatch();
            
            expect(firestore.updateCoreProfile).toHaveBeenCalled();
            expect(gemini.generateTimelineSummary).toHaveBeenCalledWith(['post1'], 'old summary');
            expect(firestore.saveTimelineSummary).toHaveBeenCalledWith('new summary');
        });

        it('should skip timeline summary if no recent posts (boundary case)', async () => {
            (firestore.getAllUsers as jest.Mock).mockResolvedValueOnce([]);
            (firestore.getRecentTimelinePosts as jest.Mock).mockResolvedValueOnce([]);
            
            await runGlobalDreamingBatch();
            
            expect(gemini.generateTimelineSummary).not.toHaveBeenCalled();
            expect(firestore.saveTimelineSummary).not.toHaveBeenCalled();
        });

        it('should catch timeline summary error (abnormal case)', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (firestore.getAllUsers as jest.Mock).mockResolvedValueOnce([]);
            (firestore.getRecentTimelinePosts as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));
            
            await runGlobalDreamingBatch();
            
            expect(consoleSpy).toHaveBeenCalledWith('Failed to summarize timeline', expect.any(Error));
            
            consoleSpy.mockRestore();
        });
    });
});
