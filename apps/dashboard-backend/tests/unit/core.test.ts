import { getJstDateRangeInUtc } from '../../src/core/dateUtils';
import { deleteTweetViaGrpc } from '../../src/core/grpcClient';
import { initializeSettingsModule } from '../../src/features/settings/index';
import { config } from '../../src/config';
import { Request, Response } from 'express';

// Mock gRPC Client for core tests
jest.mock('@grpc/grpc-js', () => {
  return {
    loadPackageDefinition: jest.fn().mockReturnValue({
      tweets: {
        TweetService: jest.fn().mockImplementation(() => ({
          deleteTweet: jest.fn().mockImplementation((req: { tweet_id: string }, callback: (err: Error | null, response?: unknown) => void) => {
            if (req.tweet_id === 'error_grpc') {
              callback(new Error('gRPC connection error'), null);
            } else {
              callback(null, { success: true, message: 'Tweet deleted successfully' });
            }
          })
        }))
      }
    }),
    credentials: {
      createInsecure: jest.fn().mockReturnValue({})
    }
  };
});

jest.mock('@grpc/proto-loader', () => ({
  loadSync: jest.fn().mockReturnValue({})
}));

describe('Dashboard Backend Core & Settings Unit Tests', () => {
  describe('dateUtils - getJstDateRangeInUtc', () => {
    it('should return null for all-time or missing date', () => {
      expect(getJstDateRangeInUtc('all-time')).toBeNull();
      expect(getJstDateRangeInUtc('monthly')).toBeNull();
      expect(getJstDateRangeInUtc('unknown', '2026-08')).toBeNull();
    });

    it('should calculate valid UTC range for yearly period', () => {
      const res = getJstDateRangeInUtc('yearly', '2026');
      expect(res).not.toBeNull();
      expect(res?.start).toContain('2025-12-31T15:00:00.000Z'); // 2026-01-01 00:00 JST is 2025-12-31 15:00 UTC
      expect(res?.end).toContain('2026-12-31T14:59:59.999Z'); // 2026-12-31 23:59:59.999 JST

      // Invalid year
      expect(getJstDateRangeInUtc('yearly', 'INVALID_YEAR')).toBeNull();
    });

    it('should calculate valid UTC range for monthly period', () => {
      const res = getJstDateRangeInUtc('monthly', '2026-07');
      expect(res).not.toBeNull();
      expect(res?.start).toContain('2026-06-30T15:00:00.000Z'); // 2026-07-01 00:00 JST is 2026-06-30 15:00 UTC

      // Invalid format
      expect(getJstDateRangeInUtc('monthly', 'invalid-month')).toBeNull();
    });
  });

  describe('grpcClient - deleteTweetViaGrpc', () => {
    it('should resolve on successful gRPC call', async () => {
      const result = await deleteTweetViaGrpc('123456');
      expect(result).toEqual({ success: true, message: 'Tweet deleted successfully' });
    });

    it('should reject on gRPC error', async () => {
      await expect(deleteTweetViaGrpc('error_grpc')).rejects.toThrow('gRPC connection error');
    });
  });

  describe('config', () => {
    it('should load default configuration properties', () => {
      expect(config.server).toBeDefined();
      expect(config.gcp).toBeDefined();
      expect(config.gemini).toBeDefined();
    });
  });

  describe('Settings Module (initializeSettingsModule)', () => {
    let mockGet: jest.Mock;
    let mockSet: jest.Mock;
    let mockDoc: jest.Mock;
    let mockCollection: jest.Mock;
    let mockFirestore: any;

    beforeEach(() => {
      mockGet = jest.fn();
      mockSet = jest.fn();
      mockDoc = jest.fn().mockReturnValue({ get: mockGet, set: mockSet });
      mockCollection = jest.fn().mockReturnValue({ doc: mockDoc });
      mockFirestore = { collection: mockCollection };
    });

    it('should get default settings if document does not exist', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const router = initializeSettingsModule(mockFirestore);

      const req = {} as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      // Extract GET handler from router stack
      const getLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'ja', timezone: 'Asia/Tokyo' })
      });
    });

    it('should return existing settings from firestore', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ language: 'en', timezone: 'UTC', updatedAt: '2026-08-18' })
      });
      const router = initializeSettingsModule(mockFirestore);

      const req = {} as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const getLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: { language: 'en', timezone: 'UTC', updatedAt: '2026-08-18' }
      });
    });

    it('should handle errors on GET settings', async () => {
      mockGet.mockRejectedValueOnce(new Error('Firestore error'));
      const router = initializeSettingsModule(mockFirestore);

      const req = {} as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const getLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to retrieve settings' });
    });

    it('should update settings on PATCH /', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ language: 'en', timezone: 'America/New_York', updatedAt: '2026-08-19' })
      });

      const router = initializeSettingsModule(mockFirestore);

      const req = { body: { language: 'en', timezone: 'America/New_York' } } as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const patchLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.patch);
      await patchLayer.route.stack[0].handle(req, res);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en', timezone: 'America/New_York' }),
        { merge: true }
      );
      expect(res.json).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'en', timezone: 'America/New_York' })
      });
    });

    it('should fallback to defaults if firestore document data has missing fields', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({})
      });
      const router = initializeSettingsModule(mockFirestore);

      const req = {} as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const getLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.get);
      await getLayer.route.stack[0].handle(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'ja', timezone: 'Asia/Tokyo' })
      });
    });

    it('should support partial updates on PATCH settings', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ language: 'ja', timezone: 'Asia/Tokyo' })
      });

      const router = initializeSettingsModule(mockFirestore);

      // Only timezone
      const req = { body: { timezone: 'Asia/Tokyo' } } as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const patchLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.patch);
      await patchLayer.route.stack[0].handle(req, res);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'Asia/Tokyo' }),
        { merge: true }
      );
    });

    it('should reject invalid language with 400 Bad Request', async () => {
      const router = initializeSettingsModule(mockFirestore);

      const req = { body: { language: 'fr' } } as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const patchLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.patch);
      await patchLayer.route.stack[0].handle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid language: must be "ja" or "en"' });
    });

    it('should reject invalid timezone with 400 Bad Request', async () => {
      const router = initializeSettingsModule(mockFirestore);

      const req = { body: { timezone: 'Invalid/Zone_Name' } } as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const patchLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.patch);
      await patchLayer.route.stack[0].handle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid timezone: must be a valid IANA timezone identifier' });
    });

    it('should handle errors on PATCH settings', async () => {
      mockSet.mockRejectedValueOnce(new Error('Firestore write error'));
      const router = initializeSettingsModule(mockFirestore);

      const req = { body: { language: 'en' } } as Request;
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as unknown as Response;

      const patchLayer = (router as any).stack.find((layer: any) => layer.route?.methods?.patch);
      await patchLayer.route.stack[0].handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update settings' });
    });
  });
});
