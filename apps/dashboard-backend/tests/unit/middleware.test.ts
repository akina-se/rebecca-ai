import { Request, Response, NextFunction } from 'express';
import { verifyAuth } from '../../src/middleware/auth';

const mockVerifyIdToken = jest.fn();
const mockGet = jest.fn();
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockWhere2 = jest.fn(() => ({ limit: mockLimit }));
const mockWhere1 = jest.fn(() => ({ where: mockWhere2 }));
const mockCollection = jest.fn(() => ({ where: mockWhere1 }));

jest.mock('../../src/lib/firebase', () => ({
  getAdminAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
  getAdminFirestore: () => ({
    collection: mockCollection,
  }),
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
  const originalEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.NO_AUTH = 'false';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.NO_AUTH = originalNoAuth;
    if (originalEmulatorHost !== undefined) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = originalEmulatorHost;
    } else {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    }
  });

  describe('verifyAuth', () => {
    it('should bypass on OPTIONS requests', async () => {
      const req = { method: 'OPTIONS' } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should NOT bypass auth if NO_AUTH is true but emulator host is NOT set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NO_AUTH = 'true';
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

      const req = { method: 'GET', headers: {} } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should bypass auth if NO_AUTH is true, not in production, and emulator host is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NO_AUTH = 'true';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

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
    });

    it('should allow user with SUPER_ADMIN role claim', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer super-admin-token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-1',
        email: 'super@rebecca.ai',
        role: 'SUPER_ADMIN',
      });

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({
        uid: 'user-1',
        email: 'super@rebecca.ai',
        role: 'SUPER_ADMIN',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should allow user with ADMIN role claim', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer admin-token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-2',
        email: 'admin@rebecca.ai',
        role: 'ADMIN',
      });

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({
        uid: 'user-2',
        email: 'admin@rebecca.ai',
        role: 'ADMIN',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should fallback to Firestore admin_users collection if claims missing and user is ACTIVE', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer valid-user-token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-3',
        email: 'firestore-admin@rebecca.ai',
      });

      mockFirestoreGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              email: 'firestore-admin@rebecca.ai',
              role: 'ADMIN',
              status: 'ACTIVE',
            }),
          },
        ],
      });

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({
        uid: 'user-3',
        email: 'firestore-admin@rebecca.ai',
        role: 'ADMIN',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 403 if Firestore admin user status is REVOKED', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer revoked-token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-revoked',
        email: 'revoked@rebecca.ai',
      });

      mockFirestoreGet.mockResolvedValue({
        empty: true,
      });

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Forbidden') })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if verifyIdToken throws error', async () => {
      const req = { method: 'GET', headers: { authorization: 'Bearer bad-token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      mockVerifyIdToken.mockRejectedValue(new Error('Firebase Auth Token Expired'));

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
