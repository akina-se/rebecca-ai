import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';

const runGlobalEvolutionBatch = async () => {
    console.log("Starting Global Evolution Batch...");
    try {
        // 1. Fetch recent logs (last 7 days)
        const logs = await firestore.getRecentConversationLogs(7);
        if (logs.length === 0) {
            console.log("No recent logs found. Skipping evolution.");
            return { status: 'skipped', reason: 'No logs found' };
        }

        // Format logs compactly
        const logsText = logs.map(l => `User: ${l.userText}\nAI: ${l.aiText}`).join('\n---\n');

        // 2. Generate Candidate Prompt (Gemini)
        console.log(`Generating evolution prompt from ${logs.length} logs...`);
        const candidatePrompt = await gemini.generateEvolutionPrompt(logsText);
        if (!candidatePrompt) {
            console.log("Failed to generate candidate prompt.");
            return { status: 'failed', reason: 'Generation failed' };
        }
        console.log("Candidate Prompt:\n" + candidatePrompt);

        // 3. Audit Candidate Prompt (Gemma)
        console.log("Auditing candidate prompt...");
        const auditResult = await gemini.auditEvolutionPrompt(candidatePrompt);

        // 4. Autonomous Decision
        if (auditResult.pass) {
            console.log("Audit PASSED! Saving new extended prompt.");
            await firestore.saveExtendedPrompt(candidatePrompt);
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
