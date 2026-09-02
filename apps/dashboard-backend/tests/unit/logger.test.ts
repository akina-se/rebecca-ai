import { Logger, logger } from '../../src/utils/logger';

describe('Logger', () => {
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should format and emit info logs to stdout', () => {
    logger.info('Test info message', { foo: 'bar' });
    expect(stdoutSpy).toHaveBeenCalledTimes(1);

    const emitted = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(emitted.severity).toBe('INFO');
    expect(emitted.message).toBe('Test info message');
    expect(emitted.context).toEqual({ foo: 'bar' });
    expect(emitted.serviceContext.service).toBe('dashboard-backend');
  });

  it('should parse and embed trace context from x-cloud-trace-context header', () => {
    const customLogger = new Logger('custom-service', '1.0.0', 'test-project');
    customLogger.info('With trace', undefined, '105445aa7843bc8bf206b120001000/0;o=1');

    const emitted = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(emitted['logging.googleapis.com/trace']).toBe('projects/test-project/traces/105445aa7843bc8bf206b120001000');
    expect(emitted['logging.googleapis.com/spanId']).toBe('0');
    expect(emitted['logging.googleapis.com/trace_sampled']).toBe(true);
  });

  it('should handle invalid or missing traceHeader gracefully', () => {
    const customLogger = new Logger('custom-service', '1.0.0', 'test-project');
    expect(customLogger.parseTraceContext(undefined)).toEqual({});
    expect(customLogger.parseTraceContext('' as any)).toEqual({});
    expect(customLogger.parseTraceContext('invalid-header')).toEqual({
      trace: 'projects/test-project/traces/invalid-header',
      spanId: undefined,
      sampled: false
    });
  });

  it('should format and emit warning logs to stdout', () => {
    logger.warn('Test warning');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const emitted = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(emitted.severity).toBe('WARNING');
    expect(emitted.message).toBe('Test warning');
  });

  it('should format and emit debug logs to stdout', () => {
    logger.debug('Test debug');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const emitted = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(emitted.severity).toBe('DEBUG');
    expect(emitted.message).toBe('Test debug');
  });

  it('should format and emit error logs with Error instance to stderr', () => {
    const error = new Error('Something failed');
    logger.error('Operation error', error, { key: 'val' });
    expect(stderrSpy).toHaveBeenCalledTimes(1);

    const emitted = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(emitted.severity).toBe('ERROR');
    expect(emitted.message).toBe('Operation error: Something failed');
    expect(emitted.error.name).toBe('Error');
    expect(emitted.error.message).toBe('Something failed');
    expect(emitted.error.stack).toBeDefined();
    expect(emitted['@type']).toBe('type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent');
  });

  it('should format error logs with non-Error object or primitive', () => {
    logger.error('Obj error', { custom: 'err' });
    const emittedObj = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(emittedObj.error.name).toBe('NonErrorObject');

    logger.error('Primitive error', 'just a string error');
    const emittedPrim = JSON.parse(stderrSpy.mock.calls[1][0]);
    expect(emittedPrim.error.name).toBe('PrimitiveError');
    expect(emittedPrim.error.message).toBe('just a string error');

    logger.error('No error object error');
    const emittedNone = JSON.parse(stderrSpy.mock.calls[2][0]);
    expect(emittedNone.error).toBeUndefined();
  });
});
