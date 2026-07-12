import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const client = new OAuth2Client();

/**
 * Verifies if the request is authenticated via OIDC Token or Shared Secret fallback.
 * 
 * @param req - The Express request object.
 * @param expectedAudience - The expected audience for the OIDC token.
 * @param fallbackSecret - The fallback secret key.
 * @param secretHeaderName - The header name containing the fallback secret.
 * @returns A promise that resolves to true if authenticated, false otherwise.
 */
export const verifyServerToServerAuth = async (
    req: Request,
    expectedAudience: string | undefined,
    fallbackSecret: string | undefined,
    secretHeaderName: string
): Promise<boolean> => {
    // Try OIDC Token Verification (Cloud Scheduler / Cloud Tasks)
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const parts = authHeader.split(' ');
    const token = (parts.length === 2 && parts[0].toLowerCase() === 'bearer') ? parts[1] : '';

    if (token) {
        try {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: expectedAudience,
            });
            const payload = ticket.getPayload();
            
            if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
                return true;
            }
        } catch (e) {
            console.warn('OIDC token verification failed:', e);
        }
    }

    // Shared Secret Fallback (for local testing or alternative trigger)
    if (fallbackSecret) {
        try {
            const secretHeader = typeof req.headers[secretHeaderName.toLowerCase()] === 'string' ? req.headers[secretHeaderName.toLowerCase()] : '';
            if (secretHeader) {
                const providedBuffer = Buffer.from(secretHeader as string, 'utf8');
                const expectedBuffer = Buffer.from(fallbackSecret, 'utf8');
                
                if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                    return true;
                }
            }
        } catch (err) {
            console.warn('Error during secret comparison', err);
        }
    }

    return false;
};
