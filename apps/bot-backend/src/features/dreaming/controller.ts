import { Request, Response } from 'express';
import { GlobalDreamingUseCase } from './usecase';

/**
 * Handles incoming HTTP requests for the global dreaming process.
 * 
 * The global dreaming process is a background synthesis task that consolidates
 * short-term memory (episodic buffers) into long-term memory (core profiles)
 * for all users in the system.
 */
export class GlobalDreamingController {
    /**
     * Initializes a new instance of the GlobalDreamingController.
     * 
     * @param useCase - The use case responsible for orchestrating the dreaming logic.
     */
    constructor(private useCase: GlobalDreamingUseCase) {}

    /**
     * Handles the HTTP request to execute the global dreaming process.
     * 
     * @param req - The Express HTTP request object.
     * @param res - The Express HTTP response object used to return the execution status.
     * @returns A promise that resolves when the response has been sent to the client.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("dreaming error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}