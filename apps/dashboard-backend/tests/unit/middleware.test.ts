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
    it('should reject request with 401 when Authorization header is absent even if query token is present', async () => {
      const req = {
        method: 'GET',
        headers: {},
        query: { token: 'valid_query_jwt' },
      } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);

      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid Authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

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
      expect((req as any).user).toEqual({
        uid: 'local-dev-admin',
        email: 'admin@example.com',
        email_verified: true,
        role: 'ADMIN',
      });
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

    it('should call verifyIdToken with checkRevoked = true and verify against Firestore admin_users on every request', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'admin_1',
        email: 'admin@rebecca.ai',
        email_verified: true,
        role: 'ADMIN',
        admin: true,
      });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ uid: 'admin_1', role: 'ADMIN', status: 'ACTIVE' }) }]
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_admin_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid_admin_token', true);
      expect(mockFirestoreGet).toHaveBeenCalledTimes(1);
      expect((req as any).user).toEqual({
        uid: 'admin_1',
        email: 'admin@rebecca.ai',
        email_verified: true,
        role: 'ADMIN',
        admin: true,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should NOT short-circuit on custom claims and must reject immediately when status in Firestore is REVOKED', async () => {
      // 1st request: ACTIVE in Firestore
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'admin_revoked',
        email: 'revoked_admin@rebecca.ai',
        email_verified: true,
        role: 'ADMIN',
        admin: true,
      });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ uid: 'admin_revoked', role: 'ADMIN', status: 'ACTIVE' }) }]
      });
      const req1 = { method: 'GET', headers: { authorization: 'Bearer token1' } } as unknown as Request;
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next1 = jest.fn() as NextFunction;
      await verifyAuth(req1, res1, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // 2nd request immediately after revocation: same token claims, but Firestore doc is now REVOKED
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'admin_revoked',
        email: 'revoked_admin@rebecca.ai',
        email_verified: true,
        role: 'ADMIN',
        admin: true,
      });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ uid: 'admin_revoked', role: 'ADMIN', status: 'REVOKED' }) }]
      });
      const req2 = { method: 'GET', headers: { authorization: 'Bearer token1' } } as unknown as Request;
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next2 = jest.fn() as NextFunction;
      await verifyAuth(req2, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(403);
      expect(res2.json).toHaveBeenCalledWith({ error: 'Forbidden: Your admin access has been revoked.' });
      expect(next2).not.toHaveBeenCalled();
    });

    it('should return 403 when user in Firestore has a non-ADMIN role (e.g. VIEWER or OPERATOR)', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'viewer_1',
        email: 'viewer@rebecca.ai',
        email_verified: true,
      });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ uid: 'viewer_1', role: 'VIEWER', status: 'ACTIVE' }) }]
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer viewer_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Insufficient role privileges.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when email_verified is false or missing in Firebase ID token', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'admin_unverified',
        email: 'admin@rebecca.ai',
        email_verified: false,
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer unverified_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(mockFirestoreGet).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Verified email address is required.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when Firestore admin_users uid does not match token uid (pre-registration takeover defense)', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'attacker_uid',
        email: 'admin@rebecca.ai',
        email_verified: true,
      });
      mockFirestoreGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ uid: 'legitimate_admin_uid', role: 'ADMIN', status: 'ACTIVE' }) }]
      });

      const req = { method: 'GET', headers: { authorization: 'Bearer mismatched_uid_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Administrator identity mismatch.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not found in Firestore admin_users', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'unauthorized_user',
        email: 'stranger@example.com',
        email_verified: true,
      });
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

    it('should return 403 when token has no email', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'no_email_user' });

      const req = { method: 'GET', headers: { authorization: 'Bearer no_email_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails or token is revoked in Firebase Auth', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Firebase ID token has been revoked.'));

      const req = { method: 'GET', headers: { authorization: 'Bearer revoked_jwt_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
