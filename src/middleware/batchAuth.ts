import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import config from '../config';

const client = new OAuth2Client();

/**
 * Middleware to authenticate requests to /batch endpoints.
 * It verifies the OIDC token sent by Google Cloud Scheduler.
 * If running locally or without Cloud Scheduler, a fallback shared secret (BATCH_SECRET_KEY) can be used.
 */
export const batchAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        // 1. OIDC Token Verification (Cloud Scheduler)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                // The audience defaults to the Cloud Run service URL, which we can set via config.gcp.workerUrl
                const expectedAudience = config.gcp.workerUrl || undefined;
                const ticket = await client.verifyIdToken({
                    idToken: token,
                    audience: expectedAudience,
                });
                const payload = ticket.getPayload();
                
                // Optional: Verify that the issuer is Google
                if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
                    return next();
                }
            } catch (e) {
                console.warn('OIDC token verification failed:', e);
                // Fall back to shared secret check if configured
            }
        }

        // 2. Shared Secret Fallback (for local testing or alternative trigger)
        const secretHeader = req.headers['x-batch-secret'];
        if (config.batchSecret && typeof secretHeader === 'string') {
            try {
                const providedBuffer = Buffer.from(secretHeader, 'utf8');
                const expectedBuffer = Buffer.from(config.batchSecret, 'utf8');
                // Ensure buffers are of the same length before comparing to prevent error
                if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                    return next();
                }
            } catch (err) {
                console.warn('Error during secret comparison', err);
            }
        }

        console.warn('Unauthorized attempt to access batch endpoint.');
        res.status(401).json({ error: 'Unauthorized' });
    } catch (e) {
        console.error('Batch Auth Middleware Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
