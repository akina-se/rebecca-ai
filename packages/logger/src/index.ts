/**
 * Structured logger for Google Cloud Run, Cloud Logging, and Cloud Error Reporting.
 *
 * Complies with Google Cloud Logging JSON payload specifications:
 * - Emits single-line JSON logs to stdout (INFO, WARNING, DEBUG) and stderr (ERROR, CRITICAL).
 * - Formats severity levels using standard LogSeverity strings.
 * - Embeds serviceContext and stack traces for automated Cloud Error Reporting detection.
 * - Extracts and maps trace context from 'x-cloud-trace-context' HTTP headers.
 */

export type LogSeverity =
  | 'DEFAULT'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'ALERT'
  | 'EMERGENCY';

/**
 * Structured JSON payload format recognized by Google Cloud Logging agent.
 *
 * @see https://cloud.google.com/logging/docs/structured-logging
 */
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

/**
 * Options for customizing Logger instance parameters.
 */
export interface LoggerOptions {
  /** Service version override. Defaults to K_REVISION or npm_package_version. */
  serviceVersion?: string;
  /** Google Cloud Project ID override. Defaults to GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT. */
  projectId?: string;
}

/**
 * Resolves the running service revision or version from the environment.
 * Priority: K_REVISION (Cloud Run revision) -> npm_package_version -> 'unknown'.
 *
 * @returns The resolved service version string.
 */
export const resolveServiceVersion = (): string => {
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

/**
 * Resolves the Google Cloud Project ID from standard environment variables.
 * Priority: GCP_PROJECT_ID -> GOOGLE_CLOUD_PROJECT -> empty string.
 *
 * @returns The resolved GCP project ID string, or empty string if not configured.
 */
export const resolveProjectId = (): string => {
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

/**
 * Logger class emitting structured JSON entries to standard streams.
 */
export class Logger {
  private serviceName: string;
  private serviceVersion: string;
  private projectId: string;

  /**
   * Initializes a new Logger instance.
   *
   * @param serviceName Service identifier for serviceContext (e.g., 'bot-backend').
   * @param serviceVersion Service version string for serviceContext.
   * @param projectId GCP project ID used to build Cloud Trace resource paths.
   */
  constructor(
    serviceName = 'unknown-service',
    serviceVersion = resolveServiceVersion(),
    projectId = resolveProjectId(),
  ) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.projectId = projectId;
  }

  /**
   * Parses incoming 'x-cloud-trace-context' header into Cloud Logging trace fields.
   * Header format: "TRACE_ID/SPAN_ID;o=TRACE_TRUE"
   *
   * @param traceHeader Raw value of 'x-cloud-trace-context' HTTP request header.
   * @returns Formatted trace URI, span ID, and sampled flag.
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

  /**
   * Serializes log entry into single-line JSON and writes to stdout or stderr.
   *
   * @param payload Structured log payload to serialize and emit.
   */
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

  /**
   * Emits an informational message (severity: INFO) to stdout.
   *
   * @param message Informational log message.
   * @param context Additional structured key-value attributes.
   * @param traceHeader Optional 'x-cloud-trace-context' header string for trace linking.
   */
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

  /**
   * Emits a warning message (severity: WARNING) to stdout.
   *
   * @param message Warning log message.
   * @param context Additional structured key-value attributes.
   * @param traceHeader Optional 'x-cloud-trace-context' header string for trace linking.
   */
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

  /**
   * Emits an error event (severity: ERROR) to stderr with Cloud Error Reporting metadata.
   *
   * @param message High-level description of the error event.
   * @param err Optional Error instance or error payload to extract stack trace and message from.
   * @param context Additional structured key-value attributes.
   * @param traceHeader Optional 'x-cloud-trace-context' header string for trace linking.
   */
  public error(
    message: string,
    err?: unknown,
    context?: Record<string, unknown>,
    traceHeader?: string,
  ): void {
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

  /**
   * Emits a diagnostic debug message (severity: DEBUG) to stdout.
   *
   * @param message Debug log message.
   * @param context Additional structured key-value attributes.
   * @param traceHeader Optional 'x-cloud-trace-context' header string for trace linking.
   */
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

/**
 * Creates a configured Logger instance for a specific service.
 *
 * @param serviceName Name of the service (e.g., 'bot-backend', 'dashboard-backend').
 * @param options Optional configuration overrides for service version and project ID.
 * @returns Configured Logger instance.
 */
export const createLogger = (serviceName?: string, options?: LoggerOptions): Logger => {
  const serviceVersion = options?.serviceVersion ?? resolveServiceVersion();
  const projectId = options?.projectId ?? resolveProjectId();
  return new Logger(serviceName, serviceVersion, projectId);
};
