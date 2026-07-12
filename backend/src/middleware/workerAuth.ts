import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { verifyServerToServerAuth } from './authUtils';

/**
 * Middleware to authenticate requests to /worker endpoints.
 * It verifies the OIDC token sent by Google Cloud Tasks.
 * If running locally or without Cloud Tasks, a fallback shared secret can be used.
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
