import { Request, Response } from 'express';
import { GlobalDreamingUseCase } from './usecase';

/**
 * Controller for handling global dreaming HTTP requests.
 * Responsible for triggering the dreaming process which consolidates memories
 * and updates user profiles based on episodic buffers.
 */
export class GlobalDreamingController {
    /**
     * Creates an instance of GlobalDreamingController.
     * @param useCase - The use case that orchestrates the global dreaming logic.
     */
    constructor(private useCase: GlobalDreamingUseCase) {}

    /**
     * Handles the incoming request to execute the dreaming process.
     * @param req - The Express request object.
     * @param res - The Express response object used to return the execution status.
     * @returns A promise that resolves when the response is sent.
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