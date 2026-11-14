import { Request, Response } from 'express';
import { parseUpstreamApiError } from '@rebecca/types';
import { logger } from './logger';

/**
 * Extracts the Google Cloud Trace header from an incoming Express request.
 *
 * @param req Express request object.
 */
export function getTraceHeader(req: Request): string | undefined {
  if (typeof req.header === 'function') {
    return req.header('x-cloud-trace-context');
  }
  return req.headers?.['x-cloud-trace-context'] as string | undefined;
}

/**
 * Standardized HTTP controller error handler for Dashboard BFF routes.
 * Maps HTTP 4xx/5xx `UpstreamApiError` (and compatible status-bearing errors) to their
 * upstream status code, logs 4xx as WARNING and 5xx as ERROR, and returns `{ error }`.
 *
 * @param res Express response object.
 * @param err Caught unknown error.
 * @param defaultMessage Fallback message logged and returned when no upstream message exists.
 * @param meta Optional structured log metadata.
 * @param traceHeader Optional Google Cloud Trace header string.
 */
export function handleControllerError(
  res: Response,
  err: unknown,
  defaultMessage: string,
  meta?: Record<string, unknown>,
  traceHeader?: string
): void {
  const upstream = parseUpstreamApiError(err);
  const statusCode = upstream?.statusCode ?? 500;
  const errorMessage =
    upstream && upstream.message.trim() ? upstream.message : defaultMessage;

  if (upstream && statusCode >= 400 && statusCode < 500) {
    logger.warn(defaultMessage, { ...meta, statusCode, errorMessage }, traceHeader);
  } else {
    logger.error(defaultMessage, err, meta, traceHeader);
  }
  res.status(statusCode).json({ error: errorMessage });
}
