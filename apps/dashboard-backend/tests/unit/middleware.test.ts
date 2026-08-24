import { Request, Response, NextFunction } from 'express';
import { verifyAuth } from '../../src/middleware/auth';

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

describe('Dashboard Backend Middleware Unit Tests', () => {
  const mockFirestoreGet = mockGet;

  const originalEnv = process.env.NODE_ENV;
  const originalNoAuth = process.env.NO_AUTH;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.NO_AUTH = 'false';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.NO_AUTH = originalNoAuth;
  });

  describe('verifyAuth', () => {
    it('should bypass on OPTIONS requests', async () => {
      const req = { method: 'OPTIONS' } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should bypass auth if NO_AUTH is true and not in production', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NO_AUTH = 'true';

      const req = { method: 'GET' } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'local-dev-admin', role: 'SUPER_ADMIN' });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 401 if authorization header is missing or does not start with Bearer', async () => {
      const req = { method: 'GET', headers: {} } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();

      // Non-bearer header
      const reqBasic = { method: 'GET', headers: { authorization: 'Basic 12345' } } as unknown as Request;
      await verifyAuth(reqBasic, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should attach user and call next on valid token with custom claim SUPER_ADMIN', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_1', email: 'admin@rebecca.ai', role: 'SUPER_ADMIN' });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_super_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'admin_1', email: 'admin@rebecca.ai', role: 'SUPER_ADMIN' });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should attach user and call next on valid token with custom claim ADMIN or admin boolean', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_2', email: 'admin2@rebecca.ai', admin: true });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_admin_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'admin_2', email: 'admin2@rebecca.ai', admin: true });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should verify against Firestore admin_users when custom claim is absent', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_3', email: 'registered_admin@rebecca.ai' });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ role: 'ADMIN', status: 'ACTIVE' }) }]
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_firestore_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'admin_3', email: 'registered_admin@rebecca.ai', role: 'ADMIN' });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should hit cache on subsequent request for the same email', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_3', email: 'registered_admin@rebecca.ai' });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_cached_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user.role).toEqual('ADMIN');
      expect(next).toHaveBeenCalledTimes(1);
      // Firestore should not have been called again because it was cached
      expect(mockFirestoreGet).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not found in Firestore admin_users', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'unauthorized_user', email: 'stranger@example.com' });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: true,
        docs: []
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_unauth_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user status in cache is revoked', async () => {
      // 1. Populate cache with ACTIVE status
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_revoked', email: 'revoked_admin@rebecca.ai' });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ role: 'ADMIN', status: 'ACTIVE' }) }]
      });
      const req1 = { method: 'GET', headers: { authorization: 'Bearer token1' } } as unknown as Request;
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next1 = jest.fn() as NextFunction;
      await verifyAuth(req1, res1, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // 2. Mock token for second request and verify revoked condition after cache update
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_revoked', email: 'revoked_admin@rebecca.ai' });
      // Clear cache entry and test Firestore empty
      mockFirestoreGet.mockResolvedValueOnce({ empty: true, docs: [] });
      const req2 = { method: 'GET', headers: { authorization: 'Bearer token2' } } as unknown as Request;
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next2 = jest.fn() as NextFunction;
      await verifyAuth(req2, res2, next2);
      expect(next2).toHaveBeenCalledTimes(1);
    });

    it('should return 403 when token has no email', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'no_email_user' });

      const req = { method: 'GET', headers: { authorization: 'Bearer no_email_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Token expired'));

      const req = { method: 'GET', headers: { authorization: 'Bearer expired_jwt_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
