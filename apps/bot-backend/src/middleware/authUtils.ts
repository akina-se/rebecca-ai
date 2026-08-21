import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const client = new OAuth2Client();

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * This function first attempts to validate a Bearer token as an OIDC token using the Google Auth Library.
 * If the OIDC verification fails or the token is absent, it falls back to a timing-safe comparison of a
 * provided shared secret against a custom HTTP header.
 *
 * @param req - The Express request object containing the authorization headers.
 * @param expectedAudience - The expected audience claim for the OIDC token (typically the service URL).
 * @param fallbackSecret - The pre-shared secret key used for fallback authentication.
 * @param secretHeaderName - The name of the custom HTTP header that carries the fallback secret.
 * @returns A promise that resolves to `true` if the request is successfully authenticated; otherwise `false`.
 */
export const verifyServerToServerAuth = async (
    req: Request,
    expectedAudience: string | undefined,
    fallbackSecret: string | undefined,
    secretHeaderName: string
): Promise<boolean> => {
    // Try OIDC Token Verification (Cloud Scheduler / Cloud Tasks)
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const token = authHeader.replace(/^bearer\s+/i, '').trim();

    if (expectedAudience) {
        try {
            const ticket = await client.verifyIdToken({
                idToken: token, // Pass token directly, even if empty. Let library handle validation.
                audience: expectedAudience,
            });
            const payload = ticket.getPayload();
            
            if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
                return true;
            }
        } catch (e) {
            console.warn('OIDC token verification failed:', (e as Error).message);
        }
    }

    // Shared Secret Fallback (for local testing or alternative trigger)
    if (fallbackSecret) {
        try {
            const secretHeader = typeof req.headers[secretHeaderName.toLowerCase()] === 'string' ? req.headers[secretHeaderName.toLowerCase()] as string : '';
            
            // Perform comparison regardless of whether secretHeader is empty or not
            const providedBuffer = Buffer.from(secretHeader, 'utf8');
            const expectedBuffer = Buffer.from(fallbackSecret, 'utf8');
            
            if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                return true;
            }
        } catch (err) {
            console.warn('Error during secret comparison', err);
        }
    }

    return false;
};
