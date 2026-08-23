import { AppDependencies } from '../../types';
import { getDreamingPrompt } from '@rebecca/persona';
import { FirestoreUser } from '../../types';

/**
 * Orchestrates the core business logic for the global dreaming process.
 * 
 * This use case handles the background synthesis of episodic buffers into core
 * profiles for all registered users. It also manages the summarization of recent
 * timeline posts to maintain up-to-date context.
 */
export class GlobalDreamingUseCase {
    /**
     * Initializes a new instance of the GlobalDreamingUseCase.
     * 
     * @param deps - The application dependencies, providing access to external services like Firestore and Gemini.
     */
    constructor(private deps: AppDependencies) {}

    /**
     * Executes the global dreaming process across all users and timeline events.
     * 
     * This method retrieves all users, processes their episodic buffers to update
     * their core profiles, and generates a new summary of recent timeline posts.
     * 
     * @returns A promise resolving to an object containing the execution status.
     */
    async execute(): Promise<{ status: string }> {
        const users = await this.deps.firestore.getAllUsers();
        for (const user of users) {
            await this.processDreamingForUser(user.id, user);
        }

        try {
            const recentPosts = await this.deps.firestore.getRecentTimelinePosts(20);
            if (recentPosts.length > 0) {
                const previousSummary = await this.deps.firestore.getTimelineSummary();
                const prompt = `【過去の要約】
${previousSummary || '（まだ要約なし）'}

【レベッカの最近のツイート（古い順）】
${recentPosts.map((p, i) => `[${i + 1}] ${p}`).join('\n')}`;
                const newSummary = await this.deps.gemini.generateTimelineSummary(prompt);
                await this.deps.firestore.saveTimelineSummary(newSummary);
                console.log("Timeline summary updated:", newSummary);
            }
        } catch (e) {
            console.error("Failed to summarize timeline", e);
        }

        return { status: 'success' };
    }

    /**
     * Processes the dreaming synthesis for an individual user.
     * 
     * Consolidates the user's episodic buffer into their core profile using the Gemini model.
     * If the episodic buffer is empty, no processing occurs.
     * 
     * @param userId - The unique identifier of the user to process.
     * @param userData - The complete Firestore record associated with the user.
     * @returns A promise that resolves when the user's dreaming process completes.
     */
    private async processDreamingForUser(userId: string, userData: FirestoreUser): Promise<void> {
        const { episodicBuffer, coreProfile } = userData;
        if (!episodicBuffer?.length) {
            return;
        }

        const systemPrompt = getDreamingPrompt();
        try {
            const newCoreProfile = await this.deps.gemini.generateDreaming(systemPrompt, episodicBuffer, coreProfile);
            await this.deps.firestore.updateCoreProfile(userId, newCoreProfile);
            console.log(`Dreaming completed for user: ${userId}`);
        } catch (error) {
            console.error(`Dreaming failed for user: ${userId}`, error);
        }
    }
}