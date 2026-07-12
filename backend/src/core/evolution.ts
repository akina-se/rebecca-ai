import { AppDependencies } from '../types';
import config from '../config';

/**
 * Runs the global evolution batch process.
 * Fetches recent conversation logs, generates an evolution prompt,
 * audits the candidate prompt, and autonomously decides whether to adopt it.
 * 
 * @returns A promise resolving to the status and result of the evolution batch.
 */
const runGlobalEvolutionBatch = async (deps: AppDependencies) => {
    console.log("Starting Global Evolution Batch...");
    try {
        const logs = await deps.firestore.getRecentConversationLogs(config.evolution.lookbackDays);
        if (logs.length === 0) {
            console.log("No recent logs found. Skipping evolution.");
            return { status: 'skipped', reason: 'No logs found' };
        }

        const logsText = logs.map(l => `User: ${l.userText}\nAI: ${l.aiText}`).join('\n---\n');

        console.log(`Generating evolution prompt from ${logs.length} logs...`);
        const candidatePrompt = await deps.gemini.generateEvolutionPrompt(logsText);
        if (!candidatePrompt) {
            console.log("Failed to generate candidate prompt.");
            return { status: 'failed', reason: 'Generation failed' };
        }
        console.log("Candidate Prompt:\n" + candidatePrompt);

        console.log("Auditing candidate prompt...");
        const auditResult = await deps.gemini.auditEvolutionPrompt(candidatePrompt);

        if (auditResult.pass) {
            console.log("Audit PASSED! Saving new extended prompt.");
            await deps.firestore.saveExtendedPrompt(candidatePrompt);
            return { status: 'success', prompt: candidatePrompt };
        } else {
            console.log(`Audit FAILED. Reason: ${auditResult.reason}`);
            console.log("Discarding candidate prompt to prevent Tay's tragedy.");
            return { status: 'rejected', reason: auditResult.reason, candidate: candidatePrompt };
        }
    } catch (e) {
        console.error("Error in runGlobalEvolutionBatch:", e);
        throw e;
    }
};

export { 
    runGlobalEvolutionBatch
 };
