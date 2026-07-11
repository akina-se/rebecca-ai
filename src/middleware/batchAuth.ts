import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { verifyServerToServerAuth } from './authUtils';

/**
 * Middleware to authenticate requests to /batch endpoints.
 * It verifies the OIDC token sent by Google Cloud Scheduler.
 * If running locally or without Cloud Scheduler, a fallback shared secret (BATCH_SECRET_KEY) can be used.
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
