import { Request, Response } from 'express';
import { GlobalEvolutionUseCase } from './usecase';

/**
 * Controller for handling global evolution HTTP requests.
 * Triggers the AI personality evolution process.
 */
export class GlobalEvolutionController {
    /**
     * Creates an instance of GlobalEvolutionController.
     * @param useCase - The use case that orchestrates the global evolution logic.
     */
    constructor(private useCase: GlobalEvolutionUseCase) {}

    /**
     * Handles the incoming request to execute the global evolution process.
     * @param req - The Express request object.
     * @param res - The Express response object used to return the execution status.
     * @returns A promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("evolution error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}