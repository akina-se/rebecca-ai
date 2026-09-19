import { Request, Response } from 'express';
import { RandomEngagementUseCase } from './usecase';
import { CampaignGuard } from '../campaign';

/**
 * Controller responsible for handling random engagement HTTP requests.
 * Orchestrates the execution of the random engagement process to actively interact with targeted users.
 */
export class RandomEngagementController {
    /**
     * Instantiates the RandomEngagementController.
     * 
     * @param useCase - The use case that encapsulates the random engagement business logic.
     * @param campaignGuard - Optional campaign guard for evaluating narrative event suppression.
     */
    constructor(
        private useCase: RandomEngagementUseCase,
        private campaignGuard?: CampaignGuard,
    ) {}

    /**
     * Handles incoming HTTP requests to trigger the random engagement process.
     * 
     * @param req - The Express request object containing the incoming HTTP request data.
     * @param res - The Express response object used to return the status of the execution.
     * @returns A promise that resolves when the HTTP response has been sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            if (this.campaignGuard) {
                const suppression = await this.campaignGuard.shouldSuppressRoutinePost();
                if (suppression.shouldSuppress) {
                    console.log(`[RandomEngagementController] Suppressed by active campaign "${suppression.campaign?.title}" (${suppression.campaign?.id})`);
                    res.status(200).json({ status: 'suppressed_by_campaign', campaignId: suppression.campaign?.id });
                    return;
                }
            }

            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("engagement error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}