import { GlobalEvolutionUseCase } from '../../src/features/evolution/usecase';
import { createMockDeps } from './core/testUtils';

describe('evolution.ts', () => {
    let deps: any;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = createMockDeps();
    });

    describe('runGlobalEvolutionBatch', () => {
        it('should skip if no recent logs found', async () => {
            deps.firestore.getRecentConversationLogs.mockResolvedValueOnce([]);
            
            const result = await new GlobalEvolutionUseCase(deps).execute();
            
            expect(result.status).toBe('skipped');
            expect(result.reason).toBe('No logs found');
            expect(deps.gemini.generateEvolutionPrompt).not.toHaveBeenCalled();
        });

        it('should return failed if prompt generation fails', async () => {
            deps.firestore.getRecentConversationLogs.mockResolvedValueOnce([{ userText: 'hi', aiText: 'hello' }]);
            deps.gemini.generateEvolutionPrompt.mockResolvedValueOnce(null);
            
            const result = await new GlobalEvolutionUseCase(deps).execute();
            
            expect(result.status).toBe('failed');
            expect(result.reason).toBe('Generation failed');
            expect(deps.gemini.auditEvolutionPrompt).not.toHaveBeenCalled();
        });

        it('should save new prompt if audit passes', async () => {
            deps.firestore.getRecentConversationLogs.mockResolvedValueOnce([{ userText: 'hi', aiText: 'hello' }]);
            deps.gemini.generateEvolutionPrompt.mockResolvedValueOnce('new rule');
            deps.gemini.auditEvolutionPrompt.mockResolvedValueOnce({ pass: true });
            
            const result = await new GlobalEvolutionUseCase(deps).execute();
            
            expect(result.status).toBe('success');
            expect(result.prompt).toBe('new rule');
            expect(deps.firestore.saveExtendedPrompt).toHaveBeenCalledWith('new rule');
        });

        it('should reject and discard if audit fails', async () => {
            deps.firestore.getRecentConversationLogs.mockResolvedValueOnce([{ userText: 'hi', aiText: 'hello' }]);
            deps.gemini.generateEvolutionPrompt.mockResolvedValueOnce('bad rule');
            deps.gemini.auditEvolutionPrompt.mockResolvedValueOnce({ pass: false, reason: 'harmful' });
            
            const result = await new GlobalEvolutionUseCase(deps).execute();
            
            expect(result.status).toBe('rejected');
            expect(result.reason).toBe('harmful');
            expect(result.candidate).toBe('bad rule');
            expect(deps.firestore.saveExtendedPrompt).not.toHaveBeenCalled();
        });

        it('should throw error if underlying db throws', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            deps.firestore.getRecentConversationLogs.mockRejectedValueOnce(new Error('DB Error'));
            
            await expect(new GlobalEvolutionUseCase(deps).execute()).rejects.toThrow('DB Error');
            
            expect(consoleSpy).toHaveBeenCalledWith('Error in runGlobalEvolutionBatch:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
