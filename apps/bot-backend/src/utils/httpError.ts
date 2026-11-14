import { Response } from 'express';
import { parseUpstreamApiError } from '@rebecca/types';
import { logger } from './logger';

/**
 * Normalizes caught SDK/HTTP errors at external service boundaries (`XApiService`,
 * `GeminiService`), logging with matching severity (`WARN` for 4xx, `ERROR` for 5xx/unclassified),
 * and rethrows the normalized error.
 *
 * @param error Caught error from an external SDK or HTTP request.
 * @param logMessage Descriptive log label.
 * @param context Optional structured metadata for logging.
 */
export function rethrowUpstreamApiError(
  error: unknown,
  logMessage: string,
  context?: Record<string, unknown>
): never {
  const upstream = parseUpstreamApiError(error);
  if (upstream) {
    if (upstream.statusCode < 500) {
      logger.warn(`${logMessage}: ${upstream.message}`, {
        statusCode: upstream.statusCode,
        ...context,
      });
    } else {
      logger.error(logMessage, upstream, context);
    }
    throw upstream;
  }
  logger.error(logMessage, error, context);
  throw error;
}

/**
 * Handles uncaught controller errors uniformly by propagating structured upstream
 * HTTP status codes (4xx/5xx) and emitting matching Cloud Logging severities
 * (`WARN` for client/upstream 4xx rejections, `ERROR` for 5xx/unclassified failures).
 *
 * Unclassified internal errors return HTTP 500 with `{ error: 'Internal Server Error' }`
 * so internal exception details are never leaked to callers.
 *
 * @param res Express response instance.
 * @param err Caught exception value from the use case or service layer.
 * @param logLabel Context message for structured logs.
 */
export function handleControllerError(
  res: Response,
  err: unknown,
  logLabel: string
): void {
  const upstreamError = parseUpstreamApiError(err);
  if (upstreamError) {
    const message = upstreamError.message.trim()
      ? upstreamError.message
      : `HTTP ${upstreamError.statusCode}`;
    if (upstreamError.statusCode < 500) {
      logger.warn(`${logLabel}: ${message}`, { statusCode: upstreamError.statusCode });
    } else {
      logger.error(logLabel, upstreamError, { statusCode: upstreamError.statusCode });
    }
    res.status(upstreamError.statusCode).json({ error: message });
    return;
  }

  logger.error(logLabel, err);
  res.status(500).json({ error: 'Internal Server Error' });
}
