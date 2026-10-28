import { GoogleAuth } from 'google-auth-library';
import { config } from '../config';
import { logger } from '../utils/logger';

const googleAuth = new GoogleAuth();

/**
 * Builds HTTP headers for authenticated internal calls to the bot-backend service.
 *
 * Priority:
 * 1. Google OIDC ID Token (`Authorization: Bearer <token>`) with `targetAudience` set to the
 *    normalized `botUrl` (used in production Cloud Run).
 * 2. Fallback shared secret (`x-worker-secret`) when OIDC token acquisition is unavailable
 *    (e.g., local development) and `BATCH_SECRET` is configured.
 *
 * @param botUrl - Base URL of the bot-backend service.
 * @returns Headers map including `Content-Type: application/json` and authentication credentials.
 */
export async function getBotServiceHeaders(botUrl: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const targetAudience = botUrl.replace(/\/+$/, '');
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(targetAudience);

  if (!isLocalhost) {
    try {
      const client = await googleAuth.getIdTokenClient(targetAudience);
      const authHeaders = await client.getRequestHeaders();
      const authHeader =
        authHeaders instanceof Headers
          ? authHeaders.get('Authorization') || authHeaders.get('authorization')
          : (authHeaders as Record<string, string>)['Authorization'] ||
            (authHeaders as Record<string, string>)['authorization'];

      if (authHeader) {
        headers['Authorization'] = authHeader;
        return headers;
      }
    } catch (err) {
      logger.warn('Failed to acquire OIDC ID token for bot-backend; falling back to shared secret if configured', {
        targetAudience,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (config.services.batchSecret) {
    headers['x-worker-secret'] = config.services.batchSecret;
  }

  return headers;
}

/**
 * Executes an authenticated internal HTTP call to the bot-backend service to delete a specified tweet on the X platform.
 *
 * @param tweetId - The unique identifier of the tweet to be deleted.
 * @returns A promise that resolves to an object indicating the success status and a descriptive message.
 */
export async function deleteTweetViaBotService(tweetId: string): Promise<{ success: boolean; message: string }> {
  const botUrl = config.services.botBackendUrl;
  if (!botUrl) {
    logger.warn('BOT_BACKEND_URL is not configured; skipping remote tweet deletion', { tweetId });
    return { success: false, message: 'BOT_BACKEND_URL not configured' };
  }

  const endpoint = `${botUrl.replace(/\/+$/, '')}/worker/tweets/${encodeURIComponent(tweetId)}`;
  const headers = await getBotServiceHeaders(botUrl);

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
    if (!res.ok) {
      const msg = typeof data.message === 'string' && data.message.trim() ? data.message : `HTTP ${res.status}`;
      logger.error('Failed to delete tweet via bot-backend HTTP', { tweetId, status: res.status, msg });
      return { success: false, message: msg };
    }

    if (typeof data.success !== 'boolean') {
      logger.error('Invalid response format from bot-backend', { tweetId, data });
      return { success: false, message: 'Invalid response from bot-backend' };
    }

    return {
      success: data.success,
      message: typeof data.message === 'string' ? data.message : '',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Failed to delete tweet via bot-backend HTTP', err, { tweetId });
    return { success: false, message };
  }
}
