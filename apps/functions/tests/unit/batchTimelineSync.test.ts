let requestHandler: any;

jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((opts, handler) => {
    requestHandler = handler;
    return handler;
  }),
}));

const mockExecute = jest.fn();
jest.mock('../../src/usecases/syncTimelineUseCase', () => ({
  SyncTimelineUseCase: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

jest.mock('../../src/services/xApi', () => ({
  XApiService: jest.fn(),
}));

import { batchTimelineSync, validateAuth } from '../../src/triggers/batchTimelineSync';

describe('validateAuth helper', () => {
  it('should return true if no configured secret is present (GCP IAM mode)', () => {
    expect(validateAuth(undefined, undefined)).toBe(true);
    expect(validateAuth('secret', undefined)).toBe(true);
  });

  it('should return false if configured secret is set but request secret is missing', () => {
    expect(validateAuth(undefined, 'my-secret')).toBe(false);
    expect(validateAuth('', 'my-secret')).toBe(false);
  });

  it('should return true if secret matches exactly', () => {
    expect(validateAuth('my-secret', 'my-secret')).toBe(true);
  });

  it('should return true if bearer token matches configured secret', () => {
    expect(validateAuth('Bearer my-secret', 'my-secret')).toBe(true);
  });

  it('should handle array header format properly', () => {
    expect(validateAuth(['Bearer my-secret', 'other'], 'my-secret')).toBe(true);
    expect(validateAuth(['wrong'], 'my-secret')).toBe(false);
  });

  it('should return false if secret does not match', () => {
    expect(validateAuth('wrong-secret', 'my-secret')).toBe(false);
    expect(validateAuth('Bearer wrong-secret', 'my-secret')).toBe(false);
  });
});

describe('batchTimelineSync HTTP trigger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      X_API_KEY: 'test_k',
      X_API_SECRET: 'test_s',
      X_ACCESS_TOKEN: 'test_t',
      X_ACCESS_SECRET: 'test_sec',
      X_BEARER_TOKEN: 'test_b',
      X_MY_USER_ID: 'user_123',
      BATCH_SECRET_KEY: 'valid_batch_secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockReqRes = (options: {
    method?: string;
    headers?: Record<string, string | string[]>;
    query?: Record<string, string>;
  }) => {
    const req: any = {
      method: options.method || 'GET',
      headers: options.headers || {},
      query: options.query || {},
    };

    const res: any = {
      statusCode: 200,
      jsonData: null,
      status: jest.fn().mockImplementation(function (code) {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation(function (data) {
        res.jsonData = data;
        return res;
      }),
    };

    return { req, res };
  };

  it('should export the function handler', () => {
    expect(batchTimelineSync).toBeDefined();
    expect(requestHandler).toBeDefined();
  });

  it('should return 405 Method Not Allowed for unsupported methods', async () => {
    const { req, res } = createMockReqRes({ method: 'DELETE' });
    await requestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.error).toBe('Method Not Allowed');
  });

  it('should return 401 Unauthorized if secret is missing or invalid', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { 'x-batch-secret': 'invalid_secret' },
    });

    await requestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.error).toBe('Unauthorized');
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should execute useCase and return 200 for valid GET request', async () => {
    mockExecute.mockResolvedValueOnce({
      processed: 10,
      updated: 3,
      created: 1,
      errors: 0,
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { 'x-batch-secret': 'valid_batch_secret' },
      query: { limit: '50' },
    });

    await requestHandler(req, res);

    expect(mockExecute).toHaveBeenCalledWith('user_123', 50);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.jsonData.success).toBe(true);
    expect(res.jsonData.data).toEqual({
      processed: 10,
      updated: 3,
      created: 1,
      errors: 0,
    });
  });

  it('should execute useCase and return 200 for valid POST request with Bearer auth', async () => {
    mockExecute.mockResolvedValueOnce({
      processed: 5,
      updated: 2,
      created: 0,
      errors: 0,
    });

    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer valid_batch_secret' },
      query: { limit: 'invalid_num' },
    });

    await requestHandler(req, res);

    expect(mockExecute).toHaveBeenCalledWith('user_123', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.jsonData.success).toBe(true);
  });

  it('should return 500 if useCase throws an error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('X API rate limit exceeded'));

    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { 'x-batch-secret': 'valid_batch_secret' },
    });

    await requestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.error).toBe('Internal Server Error');
    expect(res.jsonData.message).toBe('X API rate limit exceeded');
  });

  it('should handle non-Error objects thrown gracefully', async () => {
    mockExecute.mockRejectedValueOnce('Network disconnect');

    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { 'x-batch-secret': 'valid_batch_secret' },
    });

    await requestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.jsonData.success).toBe(false);
    expect(res.jsonData.message).toBe('An unexpected error occurred during timeline synchronization.');
  });
});
