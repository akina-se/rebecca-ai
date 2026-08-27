import { getConfig, X_SECRET_KEYS } from '../../src/config';

describe('Functions Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should export correct X_SECRET_KEYS list', () => {
    expect(X_SECRET_KEYS).toEqual([
      'X_API_KEY',
      'X_API_SECRET',
      'X_ACCESS_TOKEN',
      'X_ACCESS_SECRET',
      'X_BEARER_TOKEN',
      'X_MY_USER_ID',
    ]);
  });

  it('should populate config from environment variables', () => {
    process.env.X_API_KEY = 'test_key';
    process.env.X_API_SECRET = 'test_secret';
    process.env.X_ACCESS_TOKEN = 'test_token';
    process.env.X_ACCESS_SECRET = 'test_token_secret';
    process.env.X_BEARER_TOKEN = 'test_bearer';
    process.env.X_MY_USER_ID = 'test_user_id';

    const cfg = getConfig();
    expect(cfg.xApi.apiKey).toBe('test_key');
    expect(cfg.xApi.apiSecret).toBe('test_secret');
    expect(cfg.xApi.accessToken).toBe('test_token');
    expect(cfg.xApi.accessSecret).toBe('test_token_secret');
    expect(cfg.xApi.bearerToken).toBe('test_bearer');
    expect(cfg.xApi.myUserId).toBe('test_user_id');
  });

  it('should handle empty environment variables gracefully', () => {
    delete process.env.X_API_KEY;
    delete process.env.X_API_SECRET;
    delete process.env.X_ACCESS_TOKEN;
    delete process.env.X_ACCESS_SECRET;
    delete process.env.X_BEARER_TOKEN;
    delete process.env.X_MY_USER_ID;

    const cfg = getConfig();
    expect(cfg.xApi.apiKey).toBe('');
    expect(cfg.xApi.apiSecret).toBe('');
    expect(cfg.xApi.accessToken).toBe('');
    expect(cfg.xApi.accessSecret).toBe('');
    expect(cfg.xApi.bearerToken).toBe('');
    expect(cfg.xApi.myUserId).toBe('');
  });
});
