import { AppDependencies } from '../types';
import { getDreamingPrompt } from './prompt';
import { ConversationLogEntry, FirestoreUser } from '../types';

/**
 * Extracts a sliding window of recent interactions from the episodic buffer.
 * 
 * @param episodicBuffer - The full array of conversation log entries.
 * @param limit - The number of interaction pairs to retrieve. Defaults to 10.
 * @returns An array containing the recent conversation log entries.
 */
const getWorkingMemory = (episodicBuffer: ConversationLogEntry[] | undefined, limit = 10): ConversationLogEntry[] => {
    if (!episodicBuffer?.length) return [];
    return episodicBuffer.slice(-limit * 2); 
};

/**
 * Appends user and model interactions to the episodic buffer.
 * 
 * @param userId - The ID of the user.
 * @param userText - The text input from the user.
 * @param modelText - The text response from the model.
 */
const saveInteraction = async (deps: AppDependencies, userId: string, userText: string, modelText: string): Promise<void> => {
    await deps.firestore.appendEpisodicBuffer(userId, { role: 'user', content: userText, timestamp: new Date().toISOString() });
    await deps.firestore.appendEpisodicBuffer(userId, { role: 'model', content: modelText, timestamp: new Date().toISOString() });
};

/**
 * Integrates episodic memories into a user's core profile using a background batch process.
 * 
 * @param userId - The ID of the user.
 * @param userData - The current Firestore data for the user.
 */
const processDreamingForUser = async (deps: AppDependencies, userId: string, userData: FirestoreUser): Promise<void> => {
    const { episodicBuffer, coreProfile } = userData;
    if (!episodicBuffer?.length) {
        return;
    }

    const systemPrompt = getDreamingPrompt();
    try {
        const newCoreProfile = await deps.gemini.generateDreaming(systemPrompt, episodicBuffer, coreProfile);
        await deps.firestore.updateCoreProfile(userId, newCoreProfile);
        console.log(`Dreaming completed for user: ${userId}`);
    } catch (error) {
        console.error(`Dreaming failed for user: ${userId}`, error);
    }
};

/**
 * Executes a global batch job to consolidate personal memories for all users 
 * and summarizes recent proactive timeline posts.
 */
const runGlobalDreamingBatch = async (deps: AppDependencies): Promise<void> => {
    const users = await deps.firestore.getAllUsers();
    for (const user of users) {
        await processDreamingForUser(deps, user.id, user);
    }

    try {
        const recentPosts = await deps.firestore.getRecentTimelinePosts(10);
        if (recentPosts.length > 0) {
            const previousSummary = await deps.firestore.getTimelineSummary();
            const newSummary = await deps.gemini.generateTimelineSummary(recentPosts, previousSummary);
            await deps.firestore.saveTimelineSummary(newSummary);
            console.log("Timeline summary updated:", newSummary);
        }
    } catch (e) {
        console.error("Failed to summarize timeline", e);
    }
};

export { 
    getWorkingMemory,
    saveInteraction,
    runGlobalDreamingBatch,
    processDreamingForUser
 };
