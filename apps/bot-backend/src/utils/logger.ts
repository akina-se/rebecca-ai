/**
 * Google Cloud Logging & Cloud Error Reporting Enterprise Structured Logger
 *
 * Facade module re-exporting from shared '@rebecca/logger' package for bot-backend.
 */

import {
  createLogger,
  Logger,
  StructuredLogPayload,
  LogSeverity,
} from '@rebecca/logger';

export { Logger, StructuredLogPayload, LogSeverity, createLogger };

export const logger = createLogger('bot-backend');
