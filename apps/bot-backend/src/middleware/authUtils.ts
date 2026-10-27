import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const client = new OAuth2Client();

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * Authentication mode is determined by the presence of `expectedAudience`:
 * - **OIDC mode** (`expectedAudience` is set and Bearer token is provided): the Bearer token MUST pass
 *   Google OIDC verification. If an invalid Bearer token is provided, the request is rejected immediately
 *   to prevent credential-downgrade attacks.
 * - **Shared secret mode**: checked when no Bearer token is supplied (e.g. internal BFF-to-worker calls)
 *   or when `expectedAudience` is undefined (local development or non-OIDC tasks).
 *
 * @param req - The Express request object containing the authorization headers.
 * @param expectedAudience - The expected audience claim for the OIDC token (typically the service URL).
 * @param fallbackSecret - The pre-shared secret key used for shared-secret authentication.
 * @param secretHeaderName - The name of the custom HTTP header that carries the fallback secret.
 * @returns A promise that resolves to `true` if the request is successfully authenticated; otherwise `false`.
 */
export const verifyServerToServerAuth = async (
    req: Request,
    expectedAudience: string | undefined,
    fallbackSecret: string | undefined,
    secretHeaderName: string
): Promise<boolean> => {
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const token = authHeader.replace(/^bearer\s+/i, '').trim();

    // 1. Verify Google OIDC token if Bearer token and expectedAudience are present
    if (token && expectedAudience) {
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
            logger.warn('OIDC token verification failed', { error: (e as Error).message });
        }

        // When a Bearer token is provided with an expected audience, do not fall back to shared secret
        // to prevent credential-downgrade attacks.
        return false;
    }

    // 2. Verify shared secret (internal server-to-server auth via Secret Manager)
    if (fallbackSecret) {
        try {
            const secretHeader = typeof req.headers[secretHeaderName.toLowerCase()] === 'string' ? req.headers[secretHeaderName.toLowerCase()] as string : '';

            if (secretHeader) {
                const providedBuffer = Buffer.from(secretHeader, 'utf8');
                const expectedBuffer = Buffer.from(fallbackSecret, 'utf8');

                if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                    return true;
                }
            }
        } catch (err) {
            logger.warn('Error during secret comparison', { err });
        }
    }

    return false;
};
