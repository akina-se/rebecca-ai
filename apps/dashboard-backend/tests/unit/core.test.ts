const mockGetIdTokenClient = jest.fn();
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: (...args: any[]) => mockGetIdTokenClient(...args),
  })),
}));

import {
  getJstDateRangeInUtc,
  getTimelinePeriodRangeInUtc,
  parseRelativeDuration,
  StandardTimePeriod
} from '../../src/core/dateUtils';
import {
  deleteTweetViaBotService,
  getBotServiceHeaders,
  syncPostsViaBotService,
  triggerReplyViaBotService,
} from '../../src/core/botServiceClient';
import { initializeSettingsModule } from '../../src/features/settings/index';
import { config } from '../../src/config';
import { Request, Response } from 'express';

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

  describe('dateUtils - parseRelativeDuration', () => {
    it('should parse valid relative duration strings', () => {
      expect(parseRelativeDuration('7d')).toEqual({ count: 7, unit: 'days' });
      expect(parseRelativeDuration('14D')).toEqual({ count: 14, unit: 'days' });
      expect(parseRelativeDuration('2w')).toEqual({ count: 2, unit: 'weeks' });
      expect(parseRelativeDuration('3m')).toEqual({ count: 3, unit: 'months' });
      expect(parseRelativeDuration('1y')).toEqual({ count: 1, unit: 'years' });
    });

    it('should return null for invalid duration strings', () => {
      expect(parseRelativeDuration('')).toBeNull();
      expect(parseRelativeDuration('0d')).toBeNull();
      expect(parseRelativeDuration('-5d')).toBeNull();
      expect(parseRelativeDuration('abc')).toBeNull();
      expect(parseRelativeDuration('10x')).toBeNull();
    });
  });

  describe('dateUtils - getTimelinePeriodRangeInUtc', () => {
    it('should return null for empty, undefined, all-time, or unknown period', () => {
      expect(getTimelinePeriodRangeInUtc(undefined)).toBeNull();
      expect(getTimelinePeriodRangeInUtc('')).toBeNull();
      expect(getTimelinePeriodRangeInUtc(StandardTimePeriod.ALL_TIME)).toBeNull();
      expect(getTimelinePeriodRangeInUtc('unknown-period')).toBeNull();
    });

    it('should return range for standard presets', () => {
      const resToday = getTimelinePeriodRangeInUtc(StandardTimePeriod.TODAY);
      expect(resToday).not.toBeNull();
      expect(resToday?.start).toBeDefined();
      expect(resToday?.end).toBeDefined();

      const resWeekly = getTimelinePeriodRangeInUtc(StandardTimePeriod.WEEKLY);
      expect(resWeekly).not.toBeNull();
      expect(new Date(resWeekly!.start).getTime()).toBeLessThan(new Date(resWeekly!.end!).getTime());

      const resMonthlyDefault = getTimelinePeriodRangeInUtc(StandardTimePeriod.MONTHLY);
      expect(resMonthlyDefault).not.toBeNull();

      const resYearlyDefault = getTimelinePeriodRangeInUtc(StandardTimePeriod.YEARLY);
      expect(resYearlyDefault).not.toBeNull();
    });

    it('should return range for arbitrary relative durations (7d, 14d, 2w, 3m, 1y)', () => {
      const res7d = getTimelinePeriodRangeInUtc('7d');
      expect(res7d).not.toBeNull();
      expect(new Date(res7d!.start).getTime()).toBeLessThan(new Date(res7d!.end!).getTime());

      const res14d = getTimelinePeriodRangeInUtc('14d');
      expect(res14d).not.toBeNull();

      const res2w = getTimelinePeriodRangeInUtc('2w');
      expect(res2w).not.toBeNull();

      const res3m = getTimelinePeriodRangeInUtc('3m');
      expect(res3m).not.toBeNull();

      const res1y = getTimelinePeriodRangeInUtc('1y');
      expect(res1y).not.toBeNull();
    });

    it('should return range with calendar isoDate', () => {
      const resMonthlyWithDate = getTimelinePeriodRangeInUtc('monthly', '2026-11');
      expect(resMonthlyWithDate).not.toBeNull();

      const resYearlyWithDate = getTimelinePeriodRangeInUtc('yearly', '2026');
      expect(resYearlyWithDate).not.toBeNull();
    });
  });

  describe('botServiceClient - deleteTweetViaBotService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should resolve on successful call', async () => {
      const origUrl = config.services.botBackendUrl;
      (config.services as any).botBackendUrl = 'http://localhost:8080';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Tweet deleted successfully' }),
      } as any);
      const result = await deleteTweetViaBotService('123456');
      expect(result).toEqual({ success: true, message: 'Tweet deleted successfully' });
      (config.services as any).botBackendUrl = origUrl;
    });

    it('should return error object on network failure', async () => {
      const origUrl = config.services.botBackendUrl;
      (config.services as any).botBackendUrl = 'http://localhost:8080';
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const result = await deleteTweetViaBotService('error_id');
      expect(result).toEqual({ success: false, message: 'Network error' });
      (config.services as any).botBackendUrl = origUrl;
    });

    it('getBotServiceHeaders should attach OIDC Authorization header for non-localhost URLs', async () => {
      mockGetIdTokenClient.mockResolvedValueOnce({
        getRequestHeaders: async () => ({ Authorization: 'Bearer oidc_token_123' }),
      });

      const headers = await getBotServiceHeaders('https://bot.example.run.app/');
      expect(mockGetIdTokenClient).toHaveBeenCalledWith('https://bot.example.run.app');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer oidc_token_123',
      });
    });

    it('getBotServiceHeaders should fall back to x-worker-secret and x-batch-secret when OIDC token acquisition fails', async () => {
      const origSecret = config.services.batchSecret;
      (config.services as any).batchSecret = 'fallback_secret';
      mockGetIdTokenClient.mockRejectedValueOnce(new Error('Metadata server unavailable'));

      const headers = await getBotServiceHeaders('https://bot.example.run.app');
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'x-worker-secret': 'fallback_secret',
        'x-batch-secret': 'fallback_secret',
      });
      (config.services as any).batchSecret = origSecret;
    });

    it('syncPostsViaBotService should handle emulator fallback, missing URL, success (plain text & JSON), HTTP error, and network error', async () => {
      const origUrl = config.services.functionsUrl;
      const origEmulator = process.env.FIRESTORE_EMULATOR_HOST;

      // 1. Emulator fallback when functionsUrl is empty
      (config.services as any).functionsUrl = '';
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      const emuRes = await syncPostsViaBotService();
      expect(emuRes.success).toBe(true);
      expect(emuRes.message).toContain('emulator mode');

      // 2. Missing URL outside emulator
      delete process.env.FIRESTORE_EMULATOR_HOST;
      const missingRes = await syncPostsViaBotService();
      expect(missingRes).toEqual({ success: false, message: 'FUNCTIONS_URL not configured' });

      // 3. Successful call with plain text response
      (config.services as any).functionsUrl = 'http://localhost:5001/batchTimelineSync';
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => 'OK: Timeline synced successfully.',
      } as any);
      const okRes = await syncPostsViaBotService();
      expect(okRes).toEqual({ success: true, message: 'OK: Timeline synced successfully.' });

      // 4. Successful call with JSON response
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ message: 'Synced 5 posts' }),
      } as any);
      const jsonRes = await syncPostsViaBotService();
      expect(jsonRes).toEqual({ success: true, message: 'Synced 5 posts' });

      // 5. HTTP error response with JSON error field
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Upstream X API error' }),
      } as any);
      const errHttpRes = await syncPostsViaBotService();
      expect(errHttpRes).toEqual({ success: false, message: 'Upstream X API error' });

      // 6. Network exception
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'));
      const netErrRes = await syncPostsViaBotService();
      expect(netErrRes).toEqual({ success: false, message: 'Connection refused' });

      (config.services as any).functionsUrl = origUrl;
      if (origEmulator !== undefined) {
        process.env.FIRESTORE_EMULATOR_HOST = origEmulator;
      } else {
        delete process.env.FIRESTORE_EMULATOR_HOST;
      }
    });

    it('triggerReplyViaBotService should handle emulator fallback, missing URL, success, HTTP error, and network error', async () => {
      const origUrl = config.services.botBackendUrl;
      const origEmulator = process.env.FIRESTORE_EMULATOR_HOST;

      // 1. Emulator fallback
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      const emuRes = await triggerReplyViaBotService();
      expect(emuRes.success).toBe(true);
      expect(emuRes.message).toContain('emulator mode');

      // 2. Missing URL outside emulator
      delete process.env.FIRESTORE_EMULATOR_HOST;
      (config.services as any).botBackendUrl = '';
      const missingRes = await triggerReplyViaBotService();
      expect(missingRes).toEqual({ success: false, message: 'BOT_BACKEND_URL not configured' });

      // 3. Successful call with empty body fallback
      (config.services as any).botBackendUrl = 'http://localhost:8080/';
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      } as any);
      const okRes = await triggerReplyViaBotService();
      expect(okRes).toEqual({ success: true, message: 'OK: Reply batch executed successfully.' });

      // 3b. Successful call with /batch/mentions JSON count payload
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ count: 3, newestId: '999' }),
      } as any);
      const countRes = await triggerReplyViaBotService();
      expect(countRes).toEqual({ success: true, message: 'OK: Processed 3 mentions.' });

      // 3c. Successful call with unrelated JSON object or primitive JSON falls back cleanly
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      } as any);
      const objRes = await triggerReplyViaBotService();
      expect(objRes).toEqual({ success: true, message: 'OK: Reply batch executed successfully.' });

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(123),
      } as any);
      const primRes = await triggerReplyViaBotService();
      expect(primRes).toEqual({ success: true, message: 'OK: Reply batch executed successfully.' });

      // 4. HTTP error response with empty body
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '',
      } as any);
      const errHttpRes = await triggerReplyViaBotService();
      expect(errHttpRes).toEqual({ success: false, message: 'HTTP 503' });

      // 5. Network exception
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Bot backend unreachable'));
      const netErrRes = await triggerReplyViaBotService();
      expect(netErrRes).toEqual({ success: false, message: 'Bot backend unreachable' });

      (config.services as any).botBackendUrl = origUrl;
      if (origEmulator !== undefined) {
        process.env.FIRESTORE_EMULATOR_HOST = origEmulator;
      } else {
        delete process.env.FIRESTORE_EMULATOR_HOST;
      }
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
