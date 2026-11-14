import { Response } from 'express';
import { parseUpstreamApiError } from '@rebecca/types';
import { logger } from './logger';

/**
 * Handles uncaught controller errors uniformly by propagating structured upstream
 * HTTP status codes (4xx/5xx) and emitting matching Cloud Logging severities
 * (`WARN` for client/upstream 4xx rejections, `ERROR` for 5xx/unclassified failures).
 *
 * When the error does not originate from an upstream HTTP boundary, `errorKey: 'error'`
 * returns HTTP 500 with a sanitized `{ error: 'Internal Server Error' }` payload to
 * prevent internal detail leakage, while `errorKey: 'message'` preserves the worker JSON
 * envelope (`{ success: false, message }`).
 *
 * @param res Express response instance.
 * @param err Caught exception value from the use case or service layer.
 * @param logLabel Context message for structured logs.
 * @param errorKey Response body envelope style (`'error'` for batch/worker controllers, `'message'` for tweet deletion worker).
 */
export function handleControllerError(
  res: Response,
  err: unknown,
  logLabel: string,
  errorKey: 'error' | 'message' = 'error'
): void {
  const upstreamError = parseUpstreamApiError(err);
  if (upstreamError) {
    const message = upstreamError.detail ?? upstreamError.message;
    if (upstreamError.statusCode >= 400 && upstreamError.statusCode < 500) {
      logger.warn(`${logLabel}: ${message}`, { statusCode: upstreamError.statusCode });
    } else {
      logger.error(logLabel, upstreamError, { statusCode: upstreamError.statusCode });
    }
    if (errorKey === 'message') {
      res.status(upstreamError.statusCode).json({ success: false, message });
      return;
    }
    res.status(upstreamError.statusCode).json({ error: message });
    return;
  }

  logger.error(logLabel, err);
  if (errorKey === 'message') {
    const fallbackMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: fallbackMessage });
    return;
  }
  res.status(500).json({ error: 'Internal Server Error' });
}
