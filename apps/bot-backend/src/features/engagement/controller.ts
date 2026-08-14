import { Request, Response } from 'express';
import { RandomEngagementUseCase } from './usecase';

/**
 * Controller responsible for handling random engagement HTTP requests.
 * Orchestrates the execution of the random engagement process to actively interact with targeted users.
 */
export class RandomEngagementController {
    /**
     * Instantiates the RandomEngagementController.
     * 
     * @param useCase - The use case that encapsulates the random engagement business logic.
     */
    constructor(private useCase: RandomEngagementUseCase) {}

    /**
     * Handles incoming HTTP requests to trigger the random engagement process.
     * 
     * @param req - The Express request object containing the incoming HTTP request data.
     * @param res - The Express response object used to return the status of the execution.
     * @returns A promise that resolves when the HTTP response has been sent.
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