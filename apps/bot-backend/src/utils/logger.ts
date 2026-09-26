/**
 * Logger facade for bot-backend.
 * Re-exports the pre-configured Logger instance and related types from '@rebecca/logger'.
 */

import {
  createLogger,
  Logger,
  StructuredLogPayload,
  LogSeverity,
} from '@rebecca/logger';

export { Logger, StructuredLogPayload, LogSeverity, createLogger };

export const logger = createLogger('bot-backend');
