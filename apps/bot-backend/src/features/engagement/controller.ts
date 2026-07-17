import { Request, Response } from 'express';
import { RandomEngagementUseCase } from './usecase';

/**
 * Controller for handling random engagement HTTP requests.
 * Triggers the random engagement process to actively reach out to users.
 */
export class RandomEngagementController {
    /**
     * Creates an instance of RandomEngagementController.
     * @param useCase - The use case that orchestrates the random engagement logic.
     */
    constructor(private useCase: RandomEngagementUseCase) {}

    /**
     * Handles the incoming request to execute the random engagement process.
     * @param req - The Express request object.
     * @param res - The Express response object used to return the execution status.
     * @returns A promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("engagement error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}