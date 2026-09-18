import { Request, Response } from 'express';
import { ProactiveNewsUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';
import { CampaignGuard } from '../campaign';

/**
 * Controller for the Proactive News feature.
 * Handles HTTP batch trigger requests and coordinates alternate soliloquy posting when news posting is skipped.
 */
export class ProactiveNewsController {
    /**
     * Initializes the ProactiveNewsController.
     * @param useCase The use case responsible for executing proactive news posting.
     * @param soliloquyUseCase The fallback use case to execute when news posting is skipped.
     * @param campaignGuard Optional campaign guard for evaluating narrative event suppression.
     */
    constructor(
        private useCase: ProactiveNewsUseCase,
        private soliloquyUseCase: SoliloquyUseCase,
        private campaignGuard?: CampaignGuard,
    ) {}

    /**
     * Handles the HTTP request to trigger the proactive news post batch job.
     * @param req The Express Request object.
     * @param res The Express Response object.
     * @returns A Promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            if (this.campaignGuard) {
                const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
                if (suppression.shouldSuppress) {
                    console.log(`[ProactiveNewsController] Suppressed by active campaign "${suppression.campaign?.title}" (${suppression.campaign?.id})`);
                    res.status(200).json({ status: 'suppressed_by_campaign', campaignId: suppression.campaign?.id });
                    return;
                }
            }

            const result = await this.useCase.execute();
            if (result.status === 'skipped') {
                console.log(`[ProactiveNewsController] News post skipped (${result.reason}). Executing alternate soliloquy post...`);
                const fallbackResult = await this.soliloquyUseCase.execute();
                res.status(200).json(fallbackResult);
                return;
            }
            res.status(200).json(result);
        } catch (error) {
            console.error('[ProactiveNewsController] Batch execution failed:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}