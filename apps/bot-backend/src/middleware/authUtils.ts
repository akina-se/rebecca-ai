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
 * Validates a Google OIDC ID token against an expected audience and mandatory service account email.
 */
export const verifyOidcToken = async (
    authHeader: string,
    expectedAudience: string | undefined,
    expectedServiceAccountEmail?: string
): Promise<boolean> => {
    if (!expectedAudience || !expectedServiceAccountEmail || !authHeader) {
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
            const tokenEmail = payload.email?.toLowerCase().trim();
            const targetEmail = expectedServiceAccountEmail.toLowerCase().trim();
            if (!tokenEmail || payload.email_verified === false || tokenEmail !== targetEmail) {
                logger.warn('[Security Alert] OIDC token service account email mismatch', {
                    expected: targetEmail,
                    received: tokenEmail,
                });
                return false;
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
 * Authentication scheme is determined by the server configuration:
 * - **OIDC Scheme**: Verifies the Google OIDC ID token against `expectedAudience` and optional
 *   `expectedServiceAccountEmail`.
 * - **Shared Secret Scheme**: When `fallbackSecret` is configured (e.g., local development),
 *   constant-time comparison validates the designated secret header. In production (`fallbackSecret` unset),
 *   `verifySecret` always returns `false`.
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
    const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

    // Verify via Google OIDC ID token or pre-shared secret (timing-safe)
    return (
        (await verifyOidcToken(authHeader, expectedAudience, expectedServiceAccountEmail)) ||
        verifySecret(secretHeader, fallbackSecret)
    );
};
