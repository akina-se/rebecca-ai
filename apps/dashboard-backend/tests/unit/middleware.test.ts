import { Request, Response, NextFunction } from 'express';
import { verifyAuth } from '../../src/middleware/auth';
import * as admin from 'firebase-admin';

jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  return {
    apps: [{ name: '[DEFAULT]' }],
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      verifyIdToken: verifyIdTokenMock
    }),
    __verifyIdTokenMock: verifyIdTokenMock
  };
});

describe('Dashboard Backend Middleware Unit Tests', () => {
  const mockVerifyIdToken = (admin as any).__verifyIdTokenMock;

  beforeEach(() => {
    jest.clearAllMocks();
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
      const originalEnv = process.env.NODE_ENV;
      const originalNoAuth = process.env.NO_AUTH;
      process.env.NODE_ENV = 'development';
      process.env.NO_AUTH = 'true';

      const req = { method: 'GET' } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'local-dev-admin' });
      expect(next).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = originalEnv;
      process.env.NO_AUTH = originalNoAuth;
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

    it('should attach user and call next on valid token verification', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin_1', email: 'admin@rebecca.ai' });

      const req = { method: 'GET', headers: { authorization: 'Bearer valid_jwt_token' } } as unknown as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await verifyAuth(req, res, next);
      expect((req as any).user).toEqual({ uid: 'admin_1', email: 'admin@rebecca.ai' });
      expect(next).toHaveBeenCalledTimes(1);
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
