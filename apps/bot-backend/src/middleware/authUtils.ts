import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const client = new OAuth2Client();

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * Authentication scheme is determined by the presented credentials:
 * - **OIDC Scheme**: When an `Authorization` header is present, the request MUST pass Google OIDC
 *   token verification against the configured `expectedAudience`. If verification fails, the request
 *   is strictly rejected without falling back to shared secret (preventing credential-downgrade attacks).
 * - **Shared Secret Scheme**: When no `Authorization` header is present but the custom secret header
 *   is provided, constant-time comparison is performed against `fallbackSecret`.
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
    const rawSecret = req.headers[secretHeaderName.toLowerCase()];
    const secretHeader = typeof rawSecret === 'string' ? rawSecret.trim() : '';

    // 1. If an authorization header is present, enforce strict Google OIDC verification
    if (authHeader) {
        if (!expectedAudience) {
            return false;
        }

        const token = authHeader.replace(/^bearer\s+/i, '').trim();
        if (!token) {
            return false;
        }

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

        return false;
    }

    // 2. Otherwise, if the shared secret header is present, enforce constant-time secret verification
    if (secretHeader) {
        if (!fallbackSecret) {
            return false;
        }

        try {
            const providedBuffer = Buffer.from(secretHeader, 'utf8');
            const expectedBuffer = Buffer.from(fallbackSecret, 'utf8');

            if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                return true;
            }
        } catch (err) {
            logger.warn('Error during secret comparison', { err });
        }

        return false;
    }

    return false;
};
