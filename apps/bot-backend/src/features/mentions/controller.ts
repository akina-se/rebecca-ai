import { Request, Response } from 'express';
import { PollMentionsUseCase } from './usecase';
import { logger } from '../../utils/logger';

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
            const { statusCode, errorMessage } = this.resolvePollError(e);
            if (statusCode >= 400 && statusCode < 500) {
                logger.warn('Upstream API rejected mentions batch', { statusCode, errorMessage });
            } else {
                logger.error('Batch error (mentions)', e, { statusCode });
            }
            res.status(statusCode).json({ error: errorMessage });
        }
    };

    private resolvePollError(err: unknown): { statusCode: number; errorMessage: string } {
        if (typeof err !== 'object' || err === null) {
            return { statusCode: 500, errorMessage: 'Internal Server Error' };
        }
        const rawStatus =
            'status' in err && typeof err.status === 'number'
                ? err.status
                : 'statusCode' in err && typeof err.statusCode === 'number'
                    ? err.statusCode
                    : undefined;
        const statusCode = rawStatus !== undefined && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;

        if (statusCode === 500) {
            return { statusCode: 500, errorMessage: 'Internal Server Error' };
        }

        let detail: string | undefined;
        if ('data' in err && typeof err.data === 'object' && err.data !== null && 'detail' in err.data) {
            const rawDetail = err.data.detail;
            if (typeof rawDetail === 'string' && rawDetail.trim()) {
                detail = rawDetail.trim();
            }
        }
        const errorMessage = detail ?? (err instanceof Error && err.message.trim() ? err.message.trim() : 'Upstream API Error');
        return { statusCode, errorMessage };
    }
}
