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
 * Validates a Google OIDC ID token against an expected audience and optional service account email.
 */
export const verifyOidcToken = async (
    authHeader: string,
    expectedAudience: string | undefined,
    expectedServiceAccountEmail?: string
): Promise<boolean> => {
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

        if (payload && (payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com')) {
            if (expectedServiceAccountEmail) {
                const tokenEmail = payload.email?.toLowerCase().trim();
                const targetEmail = expectedServiceAccountEmail.toLowerCase().trim();
                if (tokenEmail !== targetEmail) {
                    logger.warn('[Security Alert] OIDC token service account email mismatch', {
                        expected: targetEmail,
                        received: tokenEmail,
                    });
                    return false;
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        logger.warn('OIDC token verification failed', { error: (e as Error).message });
        return false;
    }
};

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * Authentication scheme is determined by the presented credentials:
 * - **OIDC Scheme**: When an `Authorization` header is present, the request must pass Google OIDC ID token
 *   verification against `expectedAudience` and optional `expectedServiceAccountEmail`. It never falls back
 *   to shared secret when an `Authorization` header is present, preventing credential-downgrade attacks.
 * - **Shared Secret Scheme**: When no `Authorization` header is present and `fallbackSecret` is configured
 *   (e.g., local development), constant-time comparison validates the designated secret header.
 *
 * @param req - The Express request object containing the authorization headers.
 * @param expectedAudience - The expected audience claim for the OIDC token (typically the service URL).
 * @param fallbackSecret - The pre-shared secret key used for shared-secret authentication.
 * @param secretHeaderName - The name of the custom HTTP header that carries the fallback secret.
 * @param expectedServiceAccountEmail - Optional expected service account email to prevent impersonation.
 * @returns A promise that resolves to `true` if the request is successfully authenticated; otherwise `false`.
 */
export const verifyServerToServerAuth = async (
    req: Request,
    expectedAudience: string | undefined,
    fallbackSecret: string | undefined,
    secretHeaderName: string,
    expectedServiceAccountEmail?: string
): Promise<boolean> => {
    const rawSecret = req.headers[secretHeaderName.toLowerCase()];
    const secretHeader = typeof rawSecret === 'string' ? rawSecret.trim() : '';
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';

    // When an Authorization header is presented, strictly verify via Google OIDC ID token
    // and never fall back to shared secret (prevents credential-downgrade attacks).
    if (authHeader.length > 0) {
        return verifyOidcToken(authHeader, expectedAudience, expectedServiceAccountEmail);
    }

    return verifySecret(secretHeader, fallbackSecret);
};
