import { Request, Response } from 'express';
import { ProactiveNewsUseCase } from './usecase';

/**
 * Controller for the Proactive News feature.
 * Adapts HTTP requests to the corresponding UseCase executions.
 */
export class ProactiveNewsController {
    /**
     * Initializes the ProactiveNewsController.
     * @param useCase The use case responsible for executing proactive news posting.
     */
    constructor(private useCase: ProactiveNewsUseCase) {}

    /**
     * Handles the HTTP request to trigger the proactive news post batch job.
     * @param req The Express Request object.
     * @param res The Express Response object.
     * @returns A Promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("news error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}