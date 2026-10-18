import { AppDependencies, FirestoreUser } from '../../types';
import { DreamingConfig, DreamingExecutionResult } from './types';
import { logger } from '../../utils/logger';

/**
 * Orchestrates the user memory consolidation (Dreaming) process.
 * 
 * Consolidates short-term episodic buffers into long-term core profiles for users
 * who have had conversation activity since their last dreaming session.
 * Enforces a 15 RPM throttling delay between users to avoid Gemini API quota exhaustion,
 * and ensures isolated per-user transactional updates so partial failures do not corrupt data.
 */
export class GlobalDreamingUseCase {
    private readonly throttleMs: number;

    /**
     * Initializes a new instance of GlobalDreamingUseCase.
     * 
     * @param deps - Application dependencies for Firestore, Gemini, and Persona.
     * @param config - Optional configuration for rate-limiting throttle duration.
     */
    constructor(
        private readonly deps: AppDependencies,
        config?: DreamingConfig,
    ) {
        this.throttleMs = config?.throttleMs ?? 4500;
    }

    /**
     * Executes the dreaming process across users with pending, unconsolidated episodic buffers.
     * 
     * @returns A promise resolving to DreamingExecutionResult detailing the execution metrics.
     */
    async execute(): Promise<DreamingExecutionResult> {
        logger.info('[GlobalDreamingUseCase] Starting user memory consolidation (dreaming)');
        const users = await this.deps.firestore.getAllUsers();

        const targetUsers = users.filter((user) => this.hasUnconsolidatedActivity(user));

        if (targetUsers.length === 0) {
            logger.info('[GlobalDreamingUseCase] No users with pending episodic buffers found. Skipping');
            return {
                status: 'skipped',
                reason: 'no_users_with_episodic_buffer',
                totalUsers: users.length,
                processedUsers: 0,
                succeeded: 0,
                failed: 0,
                skipped: users.length,
            };
        }

        logger.info('[GlobalDreamingUseCase] Found users with unconsolidated episodic buffers', {
            count: targetUsers.length,
        });

        let succeeded = 0;
        let failed = 0;

        for (let i = 0; i < targetUsers.length; i++) {
            const user = targetUsers[i];
            const success = await this.processDreamingForUser(user.id, user);
            if (success) {
                succeeded++;
            } else {
                failed++;
            }

            // Apply throttling delay between users to strictly comply with 15 RPM limits
            if (i < targetUsers.length - 1 && this.throttleMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, this.throttleMs));
            }
        }

        const status = failed === 0 ? 'success' : succeeded > 0 ? 'partial_success' : 'failed';
        logger.info('[GlobalDreamingUseCase] Completed dreaming batch', {
            succeeded,
            failed,
            total: targetUsers.length,
        });

        return {
            status,
            totalUsers: users.length,
            processedUsers: targetUsers.length,
            succeeded,
            failed,
            skipped: users.length - targetUsers.length,
        };
    }

    /**
     * Processes dreaming synthesis for an individual user.
     * Consolidates episodic buffer into core profile, atomically updates lastDreamedAt,
     * and retains the sliding window (up to 20 recent turns).
     * 
     * @param userId - Target user identifier.
     * @param userData - The user record containing episodicBuffer and coreProfile.
     * @returns True if dreaming succeeded and was saved, false otherwise.
     */
    private async processDreamingForUser(userId: string, userData: FirestoreUser): Promise<boolean> {
        const { episodicBuffer, coreProfile } = userData;
        if (!episodicBuffer || episodicBuffer.length === 0) {
            return false;
        }

        const systemPrompt = this.deps.persona.getDreamingPrompt();
        try {
            const newCoreProfile = await this.deps.gemini.generateDreaming(systemPrompt, episodicBuffer, coreProfile);
            // Retain recent 10 turn-pairs (20 entries) as sliding window to preserve continuity
            const retainedBuffer = episodicBuffer.slice(-20);
            const dreamedAt = new Date().toISOString();
            await this.deps.firestore.updateCoreProfile(userId, newCoreProfile, retainedBuffer, dreamedAt);
            logger.info('[GlobalDreamingUseCase] Successfully consolidated memory for user', { userId });
            return true;
        } catch (error) {
            logger.error('[GlobalDreamingUseCase] Dreaming failed for user', error, { userId });
            return false;
        }
    }

    /**
     * Determines whether a user has pending conversational activity requiring memory consolidation.
     *
     * Evaluates that the user has an episodic buffer and unconsolidated activity
     * since their last dreaming session. Uses epoch millisecond comparison to guard
     * against ISO-8601 string formatting or timezone offset differences.
     *
     * @param user - Firestore user entity to evaluate.
     * @returns True if the user has pending episodic activity; false otherwise.
     */
    private hasUnconsolidatedActivity(user: FirestoreUser): boolean {
        if (!Array.isArray(user.episodicBuffer) || user.episodicBuffer.length === 0) {
            return false;
        }

        if (!user.lastDreamedAt) {
            return true;
        }

        const lastSeenMs = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
        const lastDreamedMs = new Date(user.lastDreamedAt).getTime();

        return Number.isFinite(lastSeenMs) && Number.isFinite(lastDreamedMs) && lastSeenMs > lastDreamedMs;
    }
}