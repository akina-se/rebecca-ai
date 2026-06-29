import { runGlobalEvolutionBatch } from '../../src/core/evolution';
import * as firestore from '../../src/services/firestore';
import * as gemini from '../../src/services/gemini';

jest.mock('../../src/services/firestore');
jest.mock('../../src/services/gemini');

describe('evolution.ts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('runGlobalEvolutionBatch', () => {
        it('should skip if no recent logs found (boundary case)', async () => {
            (firestore.getRecentConversationLogs as jest.Mock).mockResolvedValueOnce([]);

            const result = await runGlobalEvolutionBatch();

            expect(result).toEqual({ status: 'skipped', reason: 'No logs found' });
            expect(gemini.generateEvolutionPrompt).not.toHaveBeenCalled();
        });

        it('should fail if prompt generation fails (abnormal case)', async () => {
            (firestore.getRecentConversationLogs as jest.Mock).mockResolvedValueOnce([
                { userText: 'test', aiText: 'test' }
            ]);
            (gemini.generateEvolutionPrompt as jest.Mock).mockResolvedValueOnce('');

            const result = await runGlobalEvolutionBatch();

            expect(result).toEqual({ status: 'failed', reason: 'Generation failed' });
            expect(gemini.auditEvolutionPrompt).not.toHaveBeenCalled();
        });

        it('should succeed and save prompt if audit passes (normal case)', async () => {
            (firestore.getRecentConversationLogs as jest.Mock).mockResolvedValueOnce([
                { userText: 'test', aiText: 'test' }
            ]);
            (gemini.generateEvolutionPrompt as jest.Mock).mockResolvedValueOnce('New behavior');
            (gemini.auditEvolutionPrompt as jest.Mock).mockResolvedValueOnce({ pass: true });

            const result = await runGlobalEvolutionBatch();

            expect(result).toEqual({ status: 'success', prompt: 'New behavior' });
            expect(firestore.saveExtendedPrompt).toHaveBeenCalledWith('New behavior');
        });

        it('should reject and not save prompt if audit fails (abnormal case)', async () => {
            (firestore.getRecentConversationLogs as jest.Mock).mockResolvedValueOnce([
                { userText: 'test', aiText: 'test' }
            ]);
            (gemini.generateEvolutionPrompt as jest.Mock).mockResolvedValueOnce('Bad behavior');
            (gemini.auditEvolutionPrompt as jest.Mock).mockResolvedValueOnce({ pass: false, reason: 'Toxic' });

            const result = await runGlobalEvolutionBatch();

            expect(result).toEqual({ status: 'rejected', reason: 'Toxic', candidate: 'Bad behavior' });
            expect(firestore.saveExtendedPrompt).not.toHaveBeenCalled();
        });

        it('should throw and log if any error occurs (abnormal case)', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (firestore.getRecentConversationLogs as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

            await expect(runGlobalEvolutionBatch()).rejects.toThrow('DB Error');

            expect(consoleSpy).toHaveBeenCalledWith('Error in runGlobalEvolutionBatch:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
