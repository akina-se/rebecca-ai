import { Request, Response } from 'express';
import { PollMentionsUseCase } from './usecase';

/**
 * Controller for the Mentions feature.
 * Adapts HTTP requests to UseCase invocations.
 */
export class MentionsController {
    /**
     * Initializes the MentionsController.
     * @param useCase The use case responsible for polling mentions.
     */
    constructor(private useCase: PollMentionsUseCase) {}

    /**
     * Handles the HTTP request to poll for new mentions.
     * @param req The Express Request object.
     * @param res The Express Response object.
     * @returns A Promise that resolves when the response is sent.
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
