import { AppDependencies, FirestoreUser } from '../../types';
import { DreamingConfig, DreamingExecutionResult } from './types';
import { logger } from '../../utils/logger';

/**
 * Orchestrates the user memory consolidation (Dreaming) process.
 * 
 * Consolidates short-term episodic buffers into long-term core profiles for all registered users.
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
     * Executes the dreaming process across all users with pending episodic buffers.
     * 
     * @returns A promise resolving to DreamingExecutionResult detailing the execution metrics.
     */
    async execute(): Promise<DreamingExecutionResult> {
        logger.info('[GlobalDreamingUseCase] Starting user memory consolidation (dreaming)');
        const users = await this.deps.firestore.getAllUsers();

        const targetUsers = users.filter(
            (user) => Array.isArray(user.episodicBuffer) && user.episodicBuffer.length > 0,
        );

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

        logger.info('[GlobalDreamingUseCase] Found users with episodic buffers to consolidate', {
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
     * Consolidates episodic buffer into core profile and atomically trims the buffer window.
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
            await this.deps.firestore.updateCoreProfile(userId, newCoreProfile, retainedBuffer);
            logger.info('[GlobalDreamingUseCase] Successfully consolidated memory for user', { userId });
            return true;
        } catch (error) {
            logger.error('[GlobalDreamingUseCase] Dreaming failed for user', error, { userId });
            return false;
        }
    }
}