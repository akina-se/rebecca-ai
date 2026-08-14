import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { verifyServerToServerAuth } from './authUtils';

/**
 * Express middleware to authenticate requests to batch processing endpoints.
 *
 * Validates the incoming request by checking for a valid Google OIDC token (typically
 * sent by Google Cloud Scheduler). If the token is missing or invalid, it falls back to checking
 * a shared secret to allow for local development or alternative invocation methods.
 *
 * @param req - The Express request object.
 * @param res - The Express response object used to send a 401 Unauthorized status on failure.
 * @param next - The next middleware function in the Express pipeline.
 * @returns A promise that resolves when the middleware completes execution.
 */
export const batchAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isAuthenticated = await verifyServerToServerAuth(
            req,
            config.gcp.workerUrl || undefined,
            config.batchSecret,
            'x-batch-secret'
        );

        if (isAuthenticated) {
            return next();
        }

        console.warn('Unauthorized attempt to access batch endpoint.');
        res.status(401).json({ error: 'Unauthorized' });
    } catch (e) {
        console.error('Batch Auth Middleware Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
