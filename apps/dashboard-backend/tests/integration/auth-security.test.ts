import request from 'supertest';
import { createApp } from '../../src/app';
import { createMockFirestore } from '../unit/testUtils';

const mockVerifyIdToken = jest.fn();
const mockGet = jest.fn();
const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
const mockWhere2 = jest.fn().mockReturnValue({ limit: mockLimit, get: mockGet });
const mockWhere1 = jest.fn().mockReturnValue({ where: mockWhere2, limit: mockLimit, get: mockGet });
const mockCollection = jest.fn().mockReturnValue({ where: mockWhere1 });

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn().mockReturnValue([{ name: '[DEFAULT]' }]),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockCollection,
  }),
}));

// Mock gRPC client to prevent network calls in integration tests
jest.mock('../../src/core/grpcClient', () => ({
  deleteTweetViaGrpc: jest.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
  triggerDreamingViaGrpc: jest.fn().mockResolvedValue({ success: true, message: 'Dreaming triggered' }),
}));

// Mock Google Cloud Tasks to prevent network calls
jest.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: jest.fn().mockImplementation(() => ({
      createTask: jest.fn().mockResolvedValue([{ name: 'mock-task-name' }]),
      queuePath: jest.fn().mockReturnValue('mock-queue-path'),
    })),
  };
});

describe('Dashboard Backend Zero-Trust Auth & API Security Gate Integration Tests', () => {
  let app: any;
  const mockFirestoreGet = mockGet;

  const originalEnv = process.env.NODE_ENV;
  const originalNoAuth = process.env.NO_AUTH;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.NO_AUTH = 'false';

    const mockFirestoreData = createMockFirestore();
    const mockFirestore = mockFirestoreData.firestore;

    app = createApp(mockFirestore);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.NO_AUTH = originalNoAuth;
  });

  describe('Public Endpoints (Auth Not Required)', () => {
    it('GET /health should return 200 OK without Authorization header', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'OK', service: 'dashboard-bff' });
    });

    it('GET /api/v1/config should return 200 OK without Authorization header', async () => {
      const res = await request(app).get('/api/v1/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('firebase');
    });
  });

  describe('Protected Endpoints Security Gate (Unauthenticated Access Must Be Blocked)', () => {
    const protectedEndpoints = [
      // Auth
      { method: 'get', path: '/api/v1/auth/me' },

      // Timeline & Metrics
      { method: 'get', path: '/api/v1/metrics' },
      { method: 'get', path: '/api/v1/alerts' },
      { method: 'get', path: '/api/v1/posts' },
      { method: 'get', path: '/api/v1/posts/post_123' },
      { method: 'delete', path: '/api/v1/posts', body: { ids: ['post_123'] } },

      // Users
      { method: 'get', path: '/api/v1/users' },
      { method: 'get', path: '/api/v1/users/user_123' },
      { method: 'put', path: '/api/v1/users/status', body: { userIds: ['user_123'], status: 'ACTIVE' } },
      { method: 'put', path: '/api/v1/users/user_123/memory', body: { coreProfile: {} } },

      // Copilot
      { method: 'post', path: '/api/v1/copilot/chat', body: { message: 'Hello' } },

      // System Memory
      { method: 'get', path: '/api/v1/memory/layers' },
      { method: 'get', path: '/api/v1/memory/core' },
      { method: 'get', path: '/api/v1/memory/extended' },
      { method: 'put', path: '/api/v1/memory/extended', body: { prompt: 'new prompt' } },
      { method: 'get', path: '/api/v1/memory/global' },
      { method: 'put', path: '/api/v1/memory/global', body: { prompt: 'new prompt' } },
      { method: 'post', path: '/api/v1/memory/force-dreaming' },

      // Assets
      { method: 'get', path: '/api/v1/images' },
      { method: 'get', path: '/api/v1/images/img_123' },
      { method: 'post', path: '/api/v1/images/regenerate-captions' },
      { method: 'put', path: '/api/v1/images/img_123', body: { caption: 'new caption' } },
      { method: 'delete', path: '/api/v1/images', body: { ids: ['img_123'] } },

      // Settings
      { method: 'get', path: '/api/v1/settings' },
      { method: 'patch', path: '/api/v1/settings', body: { language: 'en' } },
    ];

    protectedEndpoints.forEach(({ method, path, body }) => {
      it(`should return 401 Unauthorized and ZERO data when calling ${method.toUpperCase()} ${path} without Authorization header`, async () => {
        let req = (request(app) as any)[method](path);
        if (body) {
          req = req.send(body);
        }

        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          error: 'Unauthorized: Missing or invalid Authorization header',
        });
        // Verify no sensitive payload leaked
        expect(res.body.data).toBeUndefined();
        expect(res.body.users).toBeUndefined();
        expect(res.body.posts).toBeUndefined();
      });

      it(`should return 401 Unauthorized and ZERO data when calling ${method.toUpperCase()} ${path} with an invalid Bearer token`, async () => {
        mockVerifyIdToken.mockRejectedValueOnce(new Error('Firebase ID token has expired.'));

        let req = (request(app) as any)[method](path).set('Authorization', 'Bearer invalid_or_expired_token');
        if (body) {
          req = req.send(body);
        }

        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          error: 'Unauthorized: Invalid token',
        });
        expect(res.body.data).toBeUndefined();
      });

      it(`should return 403 Forbidden and ZERO data when calling ${method.toUpperCase()} ${path} with a non-admin account`, async () => {
        // Valid token, but not an admin (no admin claims and not in admin_users)
        mockVerifyIdToken.mockResolvedValueOnce({
          uid: 'regular_user_123',
          email: 'regular_user@example.com',
          role: 'USER', // regular user role
        });

        // Firestore query returns empty for admin_users
        mockFirestoreGet.mockResolvedValueOnce({ empty: true, docs: [] });

        let req = (request(app) as any)[method](path).set('Authorization', 'Bearer valid_user_token');
        if (body) {
          req = req.send(body);
        }

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          error: 'Forbidden: Access denied. You do not have administrative privileges.',
        });
        expect(res.body.data).toBeUndefined();
      });
    });
  });

  describe('Authorized Access (Valid Admin Token)', () => {
    it('should grant access to protected endpoints when token has admin custom claim', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'admin_123',
        email: 'admin@rebecca-ai.net',
        role: 'SUPER_ADMIN',
        admin: true,
      });

      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', 'Bearer valid_admin_token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
