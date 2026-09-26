# Shared Logger Module (`@rebecca/logger`)

Provides structured logging compliant with Google Cloud Run, Cloud Logging, and Cloud Error Reporting standards across all Rebecca AI services.

---

## Architectural Principles

- **Single-Line JSON**: Emits formatted JSON entries to `stdout` (`INFO`, `WARNING`, `DEBUG`) and `stderr` (`ERROR`, `CRITICAL`).
- **Standardized Severity**: Adheres to Google Cloud Logging `LogSeverity` levels (`DEFAULT`, `DEBUG`, `INFO`, `NOTICE`, `WARNING`, `ERROR`, `CRITICAL`, `ALERT`, `EMERGENCY`).
- **Cloud Error Reporting Integration**: Formats error events with `@type: 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent'`, stack traces, and `serviceContext` for automated error group tracking.
- **Trace Context Extraction**: Parses incoming `x-cloud-trace-context` HTTP headers (`TRACE_ID/SPAN_ID;o=SAMPLED`) into `logging.googleapis.com/trace`, `logging.googleapis.com/spanId`, and `logging.googleapis.com/trace_sampled`.
- **Zero Fallback Ambiguity**: Strictly eliminates misleading inline fallbacks or arbitrary defaults. Environmental metadata is resolved predictably via `resolveServiceVersion()` and `resolveProjectId()`.

---

## Usage

```ts
import { createLogger, Logger } from '@rebecca/logger';

export const logger = createLogger('bot-backend');

// Standard informational logging with contextual metadata
logger.info('Task execution completed', { taskId: 'task-123', durationMs: 45 });

// Warning log with trace context mapping
logger.warn('Rate limit approaching', { remaining: 5 }, req.headers['x-cloud-trace-context']);

// Error log reporting to Cloud Error Reporting
logger.error('Failed to communicate with external API', err, { endpoint: '/api/v1/resource' });
```

---

## Testing

```bash
npm run test --workspace=@rebecca/logger
```
