import { Request, Response } from 'express';
import { ConfigController } from '../../src/features/config/controller';
import { initializeConfigModule } from '../../src/features/config';

describe('Config Feature Unit Tests', () => {
  let controller: ConfigController;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    controller = new ConfigController();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default development config', () => {
    process.env.NODE_ENV = 'development';
    process.env.GCP_PROJECT_ID = 'test-project';
    delete process.env.FIREBASE_WEB_API_KEY;

    const req = {} as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as Response;

    controller.getConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      firebase: expect.objectContaining({
        apiKey: 'YOUR_API_KEY',
        projectId: 'test-project',
        authDomain: 'test-project.firebaseapp.com'
      }),
      apiUrl: '/api/v1',
      production: false
    }));
  });

  it('should return production config with custom public site url and empty fallback apiKey', () => {
    process.env.NODE_ENV = 'production';
    process.env.GCP_PROJECT_ID = 'rebecca-prod';
    process.env.FIREBASE_WEB_API_KEY = 'PROD_API_KEY_123';
    process.env.PUBLIC_SITE_URL = 'https://rebecca-ai.net';

    const req = {} as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as Response;

    controller.getConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      firebase: {
        apiKey: 'PROD_API_KEY_123',
        authDomain: 'rebecca-prod.firebaseapp.com',
        projectId: 'rebecca-prod',
        storageBucket: 'rebecca-prod.firebasestorage.app',
        messagingSenderId: '',
        appId: ''
      },
      apiUrl: '/api/v1',
      publicSiteUrl: 'https://rebecca-ai.net',
      production: true,
      useEmulators: false
    });
  });

  it('should export initializeConfigModule correctly', () => {
    const router = initializeConfigModule();
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
  });

  it('should verify global config object default values', async () => {
    const { config } = await import('../../src/config');
    expect(config.server.port).toBeGreaterThan(0);
    expect(config.gcp.location).toBeDefined();
    expect(config.gcp.imageBucketName).toBeDefined();
    expect(config.gemini.model).toBeDefined();
    expect(config.gemini.embeddingModel).toBeDefined();
  });

  it('should verify global config with custom environment variables set', () => {
    jest.isolateModules(() => {
      process.env.PORT = '9090';
      process.env.GCP_PROJECT_ID = 'custom-project';
      process.env.GCP_LOCATION = 'us-central1';
      process.env.IMAGE_BUCKET_NAME = 'custom-bucket';
      process.env.BOT_BACKEND_URL = 'http://custom-bot';
      process.env.GEMINI_API_KEY = 'custom-gemini-key';
      process.env.GEMINI_MODEL = 'gemini-custom';
      process.env.GEMINI_EMBEDDING_MODEL = 'embedding-custom';
      process.env.X_API_KEY = 'custom-x-key';
      process.env.X_API_SECRET = 'custom-x-secret';
      process.env.X_ACCESS_TOKEN = 'custom-x-token';
      process.env.X_ACCESS_TOKEN_SECRET = 'custom-x-token-secret';

      const { config: customConfig } = require('../../src/config');
      expect(customConfig.server.port).toBe(9090);
      expect(customConfig.gcp.projectId).toBe('custom-project');
      expect(customConfig.gcp.location).toBe('us-central1');
      expect(customConfig.gcp.imageBucketName).toBe('custom-bucket');
      expect(customConfig.services.botBackendUrl).toBe('http://custom-bot');
      expect(customConfig.gemini.apiKey).toBe('custom-gemini-key');
      expect(customConfig.gemini.model).toBe('gemini-custom');
      expect(customConfig.gemini.embeddingModel).toBe('embedding-custom');
      expect(customConfig.xApi.appKey).toBe('custom-x-key');
      expect(customConfig.xApi.appSecret).toBe('custom-x-secret');
      expect(customConfig.xApi.accessToken).toBe('custom-x-token');
      expect(customConfig.xApi.accessSecret).toBe('custom-x-token-secret');
    });
  });
});
