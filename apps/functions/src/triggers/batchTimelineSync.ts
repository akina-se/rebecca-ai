import crypto from 'crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { getConfig, FUNCTION_SECRET_KEYS } from '../config';
import { XApiService } from '../services/xApi';
import { SyncTimelineUseCase } from '../usecases/syncTimelineUseCase';

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
    const secretHeader = req.headers['x-batch-secret'] || req.headers['authorization'];

    if (!validateAuth(secretHeader, currentConfig.batchSecretKey)) {
      console.warn('[Security Alert] Unauthorized attempt to invoke batchTimelineSync');
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing batch authorization credentials.',
      });
      return;
    }

    try {
      console.log('[batchTimelineSync] Starting timeline and metrics synchronization...');
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

      console.log(`[batchTimelineSync] Completed successfully. Updated: ${result.updated}, Created: ${result.created}`);
      res.status(200).json({
        success: true,
        message: 'Timeline sync completed successfully.',
        data: result,
      });
    } catch (error: unknown) {
      console.error('[batchTimelineSync] Execution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during timeline synchronization.';
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: errorMessage,
      });
    }
  }
);
