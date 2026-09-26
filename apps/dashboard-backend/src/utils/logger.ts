/**
 * Google Cloud Logging & Cloud Error Reporting Enterprise Structured Logger
 * 
 * Complies with Google Cloud Run structured logging standards:
 * - Emits single-line JSON logs to stdout/stderr.
 * - Formats severity levels according to LogSeverity enum.
 * - Embeds serviceContext and stack traces for Cloud Error Reporting automatic detection.
 * - Extracts and maps trace context from 'x-cloud-trace-context'.
 */

export type LogSeverity = 'DEFAULT' | 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALERT' | 'EMERGENCY';

export interface StructuredLogPayload {
  severity: LogSeverity;
  message: string;
  timestamp?: string;
  serviceContext?: {
    service: string;
    version: string;
  };
  'logging.googleapis.com/trace'?: string;
  'logging.googleapis.com/spanId'?: string;
  'logging.googleapis.com/trace_sampled'?: boolean;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

const SERVICE_NAME = 'dashboard-backend';

const resolveServiceVersion = (): string => {
  const revision = process.env.K_REVISION?.trim();
  if (revision) {
    return revision;
  }
  const packageVersion = process.env.npm_package_version?.trim();
  if (packageVersion) {
    return packageVersion;
  }
  return 'unknown';
};

const resolveProjectId = (): string => {
  const customProjectId = process.env.GCP_PROJECT_ID?.trim();
  if (customProjectId) {
    return customProjectId;
  }
  const gcpProjectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (gcpProjectId) {
    return gcpProjectId;
  }
  return '';
};

export class Logger {
  private serviceName: string;
  private serviceVersion: string;
  private projectId: string;

  constructor(
    serviceName = SERVICE_NAME,
    serviceVersion = resolveServiceVersion(),
    projectId = resolveProjectId(),
  ) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.projectId = projectId;
  }

  /**
   * Formats trace context header (x-cloud-trace-context) into Cloud Logging trace format.
   * Header format: "TRACE_ID/SPAN_ID;o=TRACE_TRUE"
   */
  public parseTraceContext(traceHeader?: string): { trace?: string; spanId?: string; sampled?: boolean } {
    if (!traceHeader || typeof traceHeader !== 'string') {
      return {};
    }
    const [traceAndSpan, options] = traceHeader.split(';');
    const [traceId, spanId] = traceAndSpan.split('/');
    const sampled = options ? options.includes('o=1') : false;

    const cleanTraceId = traceId?.trim();
    const cleanSpanId = spanId?.trim();

    const result: { trace?: string; spanId?: string; sampled?: boolean } = { sampled };
    if (cleanTraceId && this.projectId) {
      result.trace = `projects/${this.projectId}/traces/${cleanTraceId}`;
    }
    if (cleanSpanId) {
      result.spanId = cleanSpanId;
    }

    return result;
  }

  private emit(payload: StructuredLogPayload): void {
    const entry: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      serviceContext: {
        service: this.serviceName,
        version: this.serviceVersion,
      },
      ...payload,
    };

    const serialized = JSON.stringify(entry);
    if (payload.severity === 'ERROR' || payload.severity === 'CRITICAL') {
      process.stderr.write(serialized + '\n');
    } else {
      process.stdout.write(serialized + '\n');
    }
  }

  public info(message: string, context?: Record<string, unknown>, traceHeader?: string): void {
    const traceInfo = this.parseTraceContext(traceHeader);
    this.emit({
      severity: 'INFO',
      message,
      ...(traceInfo.trace ? { 'logging.googleapis.com/trace': traceInfo.trace } : {}),
      ...(traceInfo.spanId ? { 'logging.googleapis.com/spanId': traceInfo.spanId } : {}),
      ...(traceInfo.sampled !== undefined ? { 'logging.googleapis.com/trace_sampled': traceInfo.sampled } : {}),
      context,
    });
  }

  public warn(message: string, context?: Record<string, unknown>, traceHeader?: string): void {
    const traceInfo = this.parseTraceContext(traceHeader);
    this.emit({
      severity: 'WARNING',
      message,
      ...(traceInfo.trace ? { 'logging.googleapis.com/trace': traceInfo.trace } : {}),
      ...(traceInfo.spanId ? { 'logging.googleapis.com/spanId': traceInfo.spanId } : {}),
      ...(traceInfo.sampled !== undefined ? { 'logging.googleapis.com/trace_sampled': traceInfo.sampled } : {}),
      context,
    });
  }

  public error(message: string, err?: unknown, context?: Record<string, unknown>, traceHeader?: string): void {
    const traceInfo = this.parseTraceContext(traceHeader);
    let errorObj: { name?: string; message?: string; stack?: string } | undefined;

    if (err instanceof Error) {
      errorObj = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    } else if (err && typeof err === 'object') {
      errorObj = {
        name: 'NonErrorObject',
        message: JSON.stringify(err),
      };
    } else if (err !== undefined) {
      errorObj = {
        name: 'PrimitiveError',
        message: String(err),
      };
    }

    this.emit({
      severity: 'ERROR',
      message: errorObj?.message ? `${message}: ${errorObj.message}` : message,
      error: errorObj,
      ...(traceInfo.trace ? { 'logging.googleapis.com/trace': traceInfo.trace } : {}),
      ...(traceInfo.spanId ? { 'logging.googleapis.com/spanId': traceInfo.spanId } : {}),
      ...(traceInfo.sampled !== undefined ? { 'logging.googleapis.com/trace_sampled': traceInfo.sampled } : {}),
      context,
      '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
    });
  }

  public debug(message: string, context?: Record<string, unknown>, traceHeader?: string): void {
    const traceInfo = this.parseTraceContext(traceHeader);
    this.emit({
      severity: 'DEBUG',
      message,
      ...(traceInfo.trace ? { 'logging.googleapis.com/trace': traceInfo.trace } : {}),
      ...(traceInfo.spanId ? { 'logging.googleapis.com/spanId': traceInfo.spanId } : {}),
      ...(traceInfo.sampled !== undefined ? { 'logging.googleapis.com/trace_sampled': traceInfo.sampled } : {}),
      context,
    });
  }
}

export const logger = new Logger();
