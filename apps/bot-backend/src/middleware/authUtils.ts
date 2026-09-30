import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const client = new OAuth2Client();

/**
 * Authenticates server-to-server requests by verifying a Google OIDC token or a fallback shared secret.
 *
 * Authentication mode is determined by the presence of `expectedAudience`:
 * - **OIDC mode** (`expectedAudience` is set): the Bearer token MUST pass Google OIDC verification.
 *   The shared secret is NOT checked as a fallback, preventing credential-downgrade attacks where
 *   an attacker bypasses OIDC by supplying only the shared secret.
 * - **Secret-only mode** (`expectedAudience` is undefined): the shared secret header is checked
 *   instead. This mode is intended for local development or scheduler jobs that have not yet been
 *   provisioned with an OIDC service account.
 *
 * @param req - The Express request object containing the authorization headers.
 * @param expectedAudience - The expected audience claim for the OIDC token (typically the service URL).
 *   When set, enforces strict OIDC-only authentication with no shared-secret fallback.
 * @param fallbackSecret - The pre-shared secret key used when OIDC is not configured.
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

    if (expectedAudience) {
        // OIDC-only mode: shared secret fallback is intentionally disabled to prevent
        // credential-downgrade attacks. OIDC verification must succeed or the request is rejected.
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

    // Secret-only mode: used for local development or jobs without OIDC provisioning.
    if (fallbackSecret) {
        try {
            const secretHeader = typeof req.headers[secretHeaderName.toLowerCase()] === 'string' ? req.headers[secretHeaderName.toLowerCase()] as string : '';

            const providedBuffer = Buffer.from(secretHeader, 'utf8');
            const expectedBuffer = Buffer.from(fallbackSecret, 'utf8');

            if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
                return true;
            }
        } catch (err) {
            logger.warn('Error during secret comparison', { err });
        }
    }

    return false;
};
