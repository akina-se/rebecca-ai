import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const client = new OAuth2Client();

/**
 * Validates a pre-shared secret using constant-time comparison to prevent timing attacks.
 */
export const verifySecret = (secretHeader: string, fallbackSecret: string | undefined): boolean => {
    if (!fallbackSecret || !secretHeader) {
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
};

/**
 * Validates a Google OIDC ID token against an expected audience.
 */
export const verifyOidcToken = async (authHeader: string, expectedAudience: string | undefined): Promise<boolean> => {
    if (!expectedAudience || !authHeader) {
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

        return !!(payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com'));
    } catch (e) {
        logger.warn('OIDC token verification failed', { error: (e as Error).message });
        return false;
    }
};

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * Authentication scheme is determined by the presented credentials:
 * - **Shared Secret Scheme**: When a valid pre-shared secret is provided in the designated header,
 *   constant-time comparison validates the request. If an Authorization header was also provided,
 *   it must also be valid to prevent credential-downgrade attacks.
 * - **OIDC Scheme**: In all other cases, the request must pass Google OIDC ID token verification
 *   against `expectedAudience`.
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
    const rawSecret = req.headers[secretHeaderName.toLowerCase()];
    const secretHeader = typeof rawSecret === 'string' ? rawSecret.trim() : '';
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

    // Verify via Google OIDC ID token or pre-shared secret (timing-safe)
    return (
        (await verifyOidcToken(authHeader, expectedAudience)) ||
        verifySecret(secretHeader, fallbackSecret)
    );
};
