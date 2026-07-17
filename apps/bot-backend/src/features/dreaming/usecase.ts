import { AppDependencies } from '../../types';
import { getDreamingPrompt } from '@rebecca/persona';
import { FirestoreUser } from '../../types';

/**
 * Use case for executing the global dreaming process.
 * Handles background synthesis of episodic buffers into core profiles for all users,
 * as well as timeline summarization.
 */
export class GlobalDreamingUseCase {
    /**
     * Creates an instance of GlobalDreamingUseCase.
     * @param deps - The application dependencies including firestore and gemini clients.
     */
    constructor(private deps: AppDependencies) {}

    /**
     * Executes the global dreaming process.
     * This processes the episodic buffers for all users to update their core profiles,
     * and summarizes recent timeline posts.
     * @returns A promise resolving to an object indicating the success status.
     */
    async execute(): Promise<{ status: string }> {
        const users = await this.deps.firestore.getAllUsers();
        for (const user of users) {
            await this.processDreamingForUser(user.id, user);
        }

        try {
            const recentPosts = await this.deps.firestore.getRecentTimelinePosts(10);
            if (recentPosts.length > 0) {
                const previousSummary = await this.deps.firestore.getTimelineSummary();
                const newSummary = await this.deps.gemini.generateTimelineSummary(recentPosts, previousSummary);
                await this.deps.firestore.saveTimelineSummary(newSummary);
                console.log("Timeline summary updated:", newSummary);
            }
        } catch (e) {
            console.error("Failed to summarize timeline", e);
        }

        return { status: 'success' };
    }

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