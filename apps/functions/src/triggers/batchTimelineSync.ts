import crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { OAuth2Client } from 'google-auth-library';
import { getConfig, FUNCTION_SECRET_KEYS } from '../config';
import { XApiService } from '../services/xApi';
import { SyncTimelineUseCase } from '../usecases/syncTimelineUseCase';

const oidcClient = new OAuth2Client();

/**
 * Validates request authorization using timing-safe comparison.
 * Fails closed: Rejects execution if BATCH_SECRET_KEY is not configured or token does not match.
 */
export const validateAuth = (reqSecret: string | string[] | undefined, configuredSecret?: string): boolean => {
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    // Fail-Closed: Never allow unauthenticated execution when secret is unconfigured
    return false;
  }
  if (!reqSecret) {
    return false;
  }
  const secretStr = Array.isArray(reqSecret) ? reqSecret[0] : reqSecret;
  const bearerToken = secretStr.startsWith('Bearer ') ? secretStr.slice(7).trim() : secretStr.trim();

  const tokenBuf = Buffer.from(bearerToken);
  const configBuf = Buffer.from(configuredSecret.trim());

  if (tokenBuf.length !== configBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(tokenBuf, configBuf);
};

/**
 * Validates a Google OIDC ID token against an expected audience and optional service account email.
 */
export const verifyOidcToken = async (
  authHeader: string | string[] | undefined,
  expectedAudience?: string,
  expectedServiceAccountEmail?: string
): Promise<boolean> => {
  if (!expectedAudience || !authHeader) {
    return false;
  }

  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = rawHeader.replace(/^bearer\s+/i, '').trim();
  if (!token) {
    return false;
  }

  try {
    const ticket = await oidcClient.verifyIdToken({
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
  } catch (err) {
    logger.warn('OIDC token verification failed in batchTimelineSync', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
};

/**
 * Cloud Function HTTPS endpoint invoked by Cloud Scheduler or manual trigger.
 * Executes SyncTimelineUseCase to synchronize X posts and engagement metrics into Firestore.
 */
export const batchTimelineSync = onRequest(
  {
    region: 'asia-northeast1',
    memory: '256MiB',
    timeoutSeconds: 120,
    secrets: [...FUNCTION_SECRET_KEYS],
  },
  async (req, res) => {
    // Only allow GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed',
        message: `HTTP method ${req.method} is not supported. Use GET or POST.`,
      });
      return;
    }

    const currentConfig = getConfig();
    const authHeader = req.headers['authorization'];
    const secretHeader = req.headers['x-batch-secret'] || authHeader;

    const isOidcValid = await verifyOidcToken(
      authHeader,
      currentConfig.functionsUrl,
      currentConfig.serviceAccountEmail
    );
    const isSecretValid = !isOidcValid && validateAuth(secretHeader, currentConfig.batchSecretKey);

    if (!isOidcValid && !isSecretValid) {
      logger.warn('[Security Alert] Unauthorized attempt to invoke batchTimelineSync');
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing batch authorization credentials.',
      });
      return;
    }

    try {
      logger.info('[batchTimelineSync] Starting timeline and metrics synchronization');
      const xApiService = new XApiService(currentConfig.xApi);
      const useCase = new SyncTimelineUseCase(xApiService);

      let parsedLimit: number | undefined;
      if (req.query.limit) {
        const rawLimit = parseInt(String(req.query.limit), 10);
        if (!isNaN(rawLimit)) {
          parsedLimit = Math.min(Math.max(rawLimit, 5), 100);
        }
      }
      const result = await useCase.execute(currentConfig.xApi.myUserId, parsedLimit);

      logger.info('[batchTimelineSync] Completed successfully', { updated: result.updated, created: result.created });
      res.status(200).json({
        success: true,
        message: 'Timeline sync completed successfully.',
        data: result,
      });
    } catch (error: unknown) {
      logger.error('[batchTimelineSync] Execution failed', { error });
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during timeline synchronization.';
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: errorMessage,
      });
    }
  }
);
