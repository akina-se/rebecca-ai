import { Request, Response } from 'express';
import { GlobalEvolutionUseCase } from './usecase';

/**
 * Controller responsible for handling global evolution HTTP requests.
 * Triggers the AI personality evolution process.
 */
export class GlobalEvolutionController {
    /**
     * Initializes a new instance of the GlobalEvolutionController.
     * 
     * @param useCase - The use case that orchestrates the global evolution logic.
     */
    constructor(private useCase: GlobalEvolutionUseCase) {}

    /**
     * Handles the incoming HTTP request to execute the global evolution process.
     * 
     * @param req - The Express request object containing the request data.
     * @param res - The Express response object used to send back the execution status.
     * @returns A promise that resolves when the response has been sent to the client.
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