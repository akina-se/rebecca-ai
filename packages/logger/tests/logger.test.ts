import {
  Logger,
  createLogger,
  resolveServiceVersion,
  resolveProjectId,
} from '../src/index';

describe('packages/logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('resolveServiceVersion', () => {
    it('returns K_REVISION when present', () => {
      process.env.K_REVISION = 'rev-001';
      process.env.npm_package_version = '1.0.0';
      expect(resolveServiceVersion()).toBe('rev-001');
    });

    it('returns npm_package_version when K_REVISION is absent', () => {
      delete process.env.K_REVISION;
      process.env.npm_package_version = '2.3.4';
      expect(resolveServiceVersion()).toBe('2.3.4');
    });

    it('returns unknown when both are absent', () => {
      delete process.env.K_REVISION;
      delete process.env.npm_package_version;
      expect(resolveServiceVersion()).toBe('unknown');
    });
  });

  describe('resolveProjectId', () => {
    it('returns GCP_PROJECT_ID when present', () => {
      process.env.GCP_PROJECT_ID = 'my-custom-project';
      process.env.GOOGLE_CLOUD_PROJECT = 'fallback-project';
      expect(resolveProjectId()).toBe('my-custom-project');
    });

    it('returns GOOGLE_CLOUD_PROJECT when GCP_PROJECT_ID is absent', () => {
      delete process.env.GCP_PROJECT_ID;
      process.env.GOOGLE_CLOUD_PROJECT = 'fallback-project';
      expect(resolveProjectId()).toBe('fallback-project');
    });

    it('returns empty string when neither is present', () => {
      delete process.env.GCP_PROJECT_ID;
      delete process.env.GOOGLE_CLOUD_PROJECT;
      expect(resolveProjectId()).toBe('');
    });
  });

  describe('Logger constructor and default params', () => {
    it('initializes with default parameter values when no arguments are passed', () => {
      delete process.env.K_REVISION;
      delete process.env.npm_package_version;
      delete process.env.GCP_PROJECT_ID;
      delete process.env.GOOGLE_CLOUD_PROJECT;

      const defaultLogger = new Logger();
      expect(defaultLogger).toBeDefined();

      const createdDefaultLogger = createLogger();
      expect(createdDefaultLogger).toBeDefined();
    });
  });

  describe('parseTraceContext', () => {
    it('returns empty object for empty or invalid headers', () => {
      const logger = new Logger('test-service', '1.0.0', 'test-proj');
      expect(logger.parseTraceContext()).toEqual({});
      expect(logger.parseTraceContext('')).toEqual({});
      expect(logger.parseTraceContext(undefined)).toEqual({});
    });

    it('parses trace, spanId, and sampled correctly when projectId is configured', () => {
      const logger = new Logger('test-service', '1.0.0', 'test-proj');
      const traceHeader = '105445aa7843bc8bf888d053716e0ad8/000000000000004a;o=1';
      const parsed = logger.parseTraceContext(traceHeader);

      expect(parsed).toEqual({
        trace: 'projects/test-proj/traces/105445aa7843bc8bf888d053716e0ad8',
        spanId: '000000000000004a',
        sampled: true,
      });
    });

    it('parses trace and spanId without options correctly', () => {
      const logger = new Logger('test-service', '1.0.0', 'test-proj');
      const traceHeader = 'trace-no-opts/span-no-opts';
      const parsed = logger.parseTraceContext(traceHeader);

      expect(parsed).toEqual({
        trace: 'projects/test-proj/traces/trace-no-opts',
        spanId: 'span-no-opts',
        sampled: false,
      });
    });

    it('handles trace header without spanId', () => {
      const logger = new Logger('test-service', '1.0.0', 'test-proj');
      const traceHeader = 'trace-only';
      const parsed = logger.parseTraceContext(traceHeader);

      expect(parsed).toEqual({
        trace: 'projects/test-proj/traces/trace-only',
        spanId: undefined,
        sampled: false,
      });
    });

    it('omits trace prefix when projectId is empty', () => {
      const logger = new Logger('test-service', '1.0.0', '');
      const traceHeader = '105445aa7843bc8bf888d053716e0ad8/000000000000004a;o=0';
      const parsed = logger.parseTraceContext(traceHeader);

      expect(parsed.trace).toBeUndefined();
      expect(parsed.spanId).toBe('000000000000004a');
      expect(parsed.sampled).toBe(false);
    });
  });

  describe('logging emission', () => {
    let stdoutWriteSpy: jest.SpyInstance;
    let stderrWriteSpy: jest.SpyInstance;

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutWriteSpy.mockRestore();
      stderrWriteSpy.mockRestore();
    });

    it('emits info log to stdout with structured format', () => {
      const logger = createLogger('unit-service', { serviceVersion: '0.1.0', projectId: 'test-project' });
      logger.info('System initiated', { port: 8080 }, 'trace-abc/span-123;o=1');

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);

      expect(output.severity).toBe('INFO');
      expect(output.message).toBe('System initiated');
      expect(output.serviceContext).toEqual({ service: 'unit-service', version: '0.1.0' });
      expect(output['logging.googleapis.com/trace']).toBe('projects/test-project/traces/trace-abc');
      expect(output['logging.googleapis.com/spanId']).toBe('span-123');
      expect(output['logging.googleapis.com/trace_sampled']).toBe(true);
      expect(output.context).toEqual({ port: 8080 });
      expect(output.timestamp).toBeDefined();
    });

    it('emits warn log to stdout with WARNING severity and trace context', () => {
      const logger = createLogger('unit-service', { serviceVersion: '0.1.0', projectId: 'test-project' });
      logger.warn('Resource rate limited', { retryAfter: 30 }, 'trace-warn/span-warn;o=0');

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);

      expect(output.severity).toBe('WARNING');
      expect(output.message).toBe('Resource rate limited');
      expect(output.context).toEqual({ retryAfter: 30 });
      expect(output['logging.googleapis.com/trace']).toBe('projects/test-project/traces/trace-warn');
      expect(output['logging.googleapis.com/spanId']).toBe('span-warn');
      expect(output['logging.googleapis.com/trace_sampled']).toBe(false);
    });

    it('emits debug log to stdout with DEBUG severity and trace context', () => {
      const logger = createLogger('unit-service', { projectId: 'test-project' });
      logger.debug('Cache hit', { key: 'session-1' }, 'trace-debug/span-debug;o=1');

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stdoutWriteSpy.mock.calls[0][0]);

      expect(output.severity).toBe('DEBUG');
      expect(output.message).toBe('Cache hit');
      expect(output.context).toEqual({ key: 'session-1' });
      expect(output['logging.googleapis.com/trace']).toBe('projects/test-project/traces/trace-debug');
      expect(output['logging.googleapis.com/spanId']).toBe('span-debug');
      expect(output['logging.googleapis.com/trace_sampled']).toBe(true);
    });

    it('emits error log to stderr with Error instance and Cloud Error Reporting type', () => {
      const logger = createLogger('unit-service', { serviceVersion: '1.0.0', projectId: 'test-project' });
      const testError = new Error('Database disconnected');
      logger.error('Failed to execute query', testError, { query: 'SELECT 1' }, 'trace-err/span-err;o=1');

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stderrWriteSpy.mock.calls[0][0]);

      expect(output.severity).toBe('ERROR');
      expect(output.message).toBe('Failed to execute query: Database disconnected');
      expect(output.error).toEqual({
        name: 'Error',
        message: 'Database disconnected',
        stack: testError.stack,
      });
      expect(output['@type']).toBe(
        'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent'
      );
      expect(output.context).toEqual({ query: 'SELECT 1' });
      expect(output['logging.googleapis.com/trace']).toBe('projects/test-project/traces/trace-err');
    });

    it('formats non-Error objects and primitives passed as error', () => {
      const logger = createLogger('unit-service');
      logger.error('Object error occurred', { code: 500, detail: 'bad state' });

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(stderrWriteSpy.mock.calls[0][0]);
      expect(output.error?.name).toBe('NonErrorObject');
      expect(output.error?.message).toBe(JSON.stringify({ code: 500, detail: 'bad state' }));

      stderrWriteSpy.mockClear();
      logger.error('Primitive error occurred', 'something failed', { extra: true });
      const primitiveOutput = JSON.parse(stderrWriteSpy.mock.calls[0][0]);
      expect(primitiveOutput.error?.name).toBe('PrimitiveError');
      expect(primitiveOutput.error?.message).toBe('something failed');
      expect(primitiveOutput.context).toEqual({ extra: true });

      stderrWriteSpy.mockClear();
      logger.error('No error instance provided', undefined, { attempt: 3 });
      const noErrorOutput = JSON.parse(stderrWriteSpy.mock.calls[0][0]);
      expect(noErrorOutput.error).toBeUndefined();
      expect(noErrorOutput.context).toEqual({ attempt: 3 });
    });
  });
});
