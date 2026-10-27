import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Executes an authenticated HTTP call to the bot-backend service to delete a specified tweet on the X platform.
 * Named deleteTweetViaGrpc for backward compatibility across existing use cases, controllers, and tests.
 * 
 * @param tweetId - The unique identifier of the tweet to be deleted.
 * @returns A promise that resolves to an object indicating the success status and a descriptive message.
 */
export async function deleteTweetViaGrpc(tweetId: string): Promise<{ success: boolean; message: string }> {
  const botUrl = config.services.botBackendUrl;
  if (!botUrl) {
    logger.warn('BOT_BACKEND_URL is not configured; skipping remote tweet deletion', { tweetId });
    return { success: false, message: 'BOT_BACKEND_URL not configured' };
  }

  const endpoint = `${botUrl.replace(/\/+$/, '')}/worker/tweets/${encodeURIComponent(tweetId)}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.services.batchSecret) {
    headers['x-worker-secret'] = config.services.batchSecret;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
    if (!res.ok) {
      const msg = data.message || `HTTP ${res.status}`;
      logger.error('Failed to delete tweet via bot-backend HTTP', { tweetId, status: res.status, msg });
      return { success: false, message: msg };
    }
    return { success: data.success ?? true, message: data.message || 'Tweet deleted' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Failed to delete tweet via bot-backend HTTP', err, { tweetId });
    return { success: false, message };
  }
}
