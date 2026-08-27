import { onRequest } from 'firebase-functions/v2/https';
import { getConfig, FUNCTION_SECRET_KEYS } from '../config';
import { XApiService } from '../services/xApi';
import { SyncTimelineUseCase } from '../usecases/syncTimelineUseCase';

/**
 * Validates request authorization.
 * Allows execution if:
 * 1. An explicit BATCH_SECRET_KEY is configured and provided via `X-Batch-Secret` or `Authorization: Bearer <secret>` header.
 * 2. Or, if called internally in GCP emulator / test environments where secret is not configured.
 */
export const validateAuth = (reqSecret: string | string[] | undefined, configuredSecret?: string): boolean => {
  if (!configuredSecret) {
    // If no shared secret is configured in the environment, fallback to GCP IAM / OIDC invocation
    return true;
  }
  if (!reqSecret) {
    return false;
  }
  const secretStr = Array.isArray(reqSecret) ? reqSecret[0] : reqSecret;
  const bearerToken = secretStr.startsWith('Bearer ') ? secretStr.slice(7).trim() : secretStr.trim();
  return bearerToken === configuredSecret;
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

      const customLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const result = await useCase.execute(currentConfig.xApi.myUserId, isNaN(Number(customLimit)) ? undefined : customLimit);

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
