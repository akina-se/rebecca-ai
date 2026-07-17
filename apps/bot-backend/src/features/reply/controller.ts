import { Request, Response } from 'express';
import { ReplyTaskUseCase } from './usecase';

/**
 * Controller for handling reply task HTTP requests.
 * Responsible for receiving task payloads and delegating to the ReplyTaskUseCase.
 */
export class ReplyTaskController {
    /**
     * Initializes the controller with the required use case.
     * 
     * @param useCase The use case to execute for reply tasks.
     */
    constructor(private useCase: ReplyTaskUseCase) {}

    /**
     * Handles the HTTP request for processing a reply task.
     * Validates the payload and triggers the use case.
     * 
     * @param req The Express Request object containing the task payload in the body.
     * @param res The Express Response object.
     * @returns A promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const { tweetId, text, authorId } = req.body;
            if (!tweetId || !text || !authorId) {
                res.status(400).json({ error: 'Missing required task payload fields' });
                return;
            }
            const result = await this.useCase.execute({ tweetId, text, authorId });
            res.status(200).json(result);
        } catch (e) {
            console.error("reply error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}