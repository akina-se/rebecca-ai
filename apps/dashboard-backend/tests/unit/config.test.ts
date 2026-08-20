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
        storageBucket: 'rebecca-prod.appspot.com',
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
});
