import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { verifyServerToServerAuth } from './authUtils';

/**
 * Express middleware to authenticate requests to worker endpoints.
 *
 * Validates the incoming request by verifying the Google OIDC token (typically sent by
 * Google Cloud Tasks). For local development or alternative task invocation, it falls back
 * to a shared secret verification approach.
 *
 * @param req - The Express request object.
 * @param res - The Express response object used to return a 401 Unauthorized status on authentication failure.
 * @param next - The next middleware function in the Express pipeline.
 * @returns A promise that resolves when the middleware completes execution.
 */
export const workerAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isAuthenticated = await verifyServerToServerAuth(
            req,
            config.gcp.workerUrl || undefined,
            config.batchSecret, // Utilizing the same batch secret for simplicity, or we can use a worker secret
            'x-worker-secret'
        );

        if (isAuthenticated) {
            return next();
        }

        console.warn('Unauthorized attempt to access worker endpoint.');
        res.status(401).json({ error: 'Unauthorized' });
    } catch (e) {
        console.error('Worker Auth Middleware Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
