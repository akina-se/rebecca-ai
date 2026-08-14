import { Request, Response } from 'express';
import { PollMentionsUseCase } from './usecase';

/**
 * Controller responsible for handling HTTP requests related to the Mentions feature.
 * It serves as an adapter between the Express HTTP transport layer and the application's core use cases.
 */
export class MentionsController {
    /**
     * Instantiates the MentionsController.
     * 
     * @param useCase - The primary use case for polling and processing mentions.
     */
    constructor(private useCase: PollMentionsUseCase) {}

    /**
     * Handles the HTTP request to poll for new mentions from the configured platform.
     * Invokes the polling use case and responds with the processing results.
     * 
     * @param req - The Express Request object.
     * @param res - The Express Response object.
     * @returns A Promise that resolves when the HTTP response is successfully sent.
     */
    pollMentions = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (mentions):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
