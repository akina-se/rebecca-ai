import { Request, Response } from 'express';
import { ProactiveNewsUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';

/**
 * Controller for the Proactive News feature.
 * Adapts HTTP requests and coordinates fallback to SoliloquyUseCase if no fresh news is available.
 */
export class ProactiveNewsController {
    /**
     * Initializes the ProactiveNewsController.
     * @param useCase The use case responsible for executing proactive news posting.
     * @param soliloquyUseCase The fallback usecase to execute when news posting is skipped.
     */
    constructor(
        private useCase: ProactiveNewsUseCase,
        private soliloquyUseCase: SoliloquyUseCase,
    ) {}

    /**
     * Handles the HTTP request to trigger the proactive news post batch job.
     * @param req The Express Request object.
     * @param res The Express Response object.
     * @returns A Promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            if (result.status === 'skipped') {
                console.log(`[ProactiveNewsController] News post skipped (${result.reason}). Executing soliloquy fallback...`);
                const fallbackResult = await this.soliloquyUseCase.execute();
                res.status(200).json(fallbackResult);
                return;
            }
            res.status(200).json(result);
        } catch (e) {
            console.error('[ProactiveNewsController] Batch encountered transient failure, returning 503 for Scheduler retry:', e);
            res.status(503).json({
                error: 'Service Unavailable',
                message: (e as Error).message || 'Service Unavailable',
            });
        }
    };
}