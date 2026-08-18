import { Request, Response } from 'express';
import { UsersController } from '../../src/features/users/controller';
import { UsersUseCase } from '../../src/features/users/usecase';
import { AssetsController } from '../../src/features/assets/controller';
import { AssetsUseCase } from '../../src/features/assets/usecase';
import { TimelineController } from '../../src/features/timeline/controller';
import { TimelineUseCase } from '../../src/features/timeline/usecase';
import { SystemMemoryController } from '../../src/features/system-memory/controller';
import { SystemMemoryUseCase } from '../../src/features/system-memory/usecase';
import { CopilotController } from '../../src/features/copilot/controller';
import { CopilotUseCase } from '../../src/features/copilot/usecase';
import { AuthController } from '../../src/features/auth/controller';
import { UserStatus } from '@rebecca/types';

function createMockReqRes(overrides: { body?: any; query?: any; params?: any; headers?: any; files?: any; file?: any } = {}) {
  const req: Partial<Request> = {
    body: overrides.body || {},
    query: overrides.query || {},
    params: overrides.params || {},
    headers: overrides.headers || {},
    files: overrides.files,
    file: overrides.file
  };

  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };

  return { req: req as Request, res: res as Response };
}

describe('Dashboard Backend Controllers Unit Tests', () => {
  describe('UsersController', () => {
    let useCase: jest.Mocked<UsersUseCase>;
    let controller: UsersController;

    beforeEach(() => {
      useCase = {
        getAllUsers: jest.fn(),
        getUserById: jest.fn(),
        updateUserMemory: jest.fn(),
        bulkUpdateStatus: jest.fn()
      } as unknown as jest.Mocked<UsersUseCase>;
      controller = new UsersController(useCase);
    });

    it('getAll should return user list with parsed query parameters', async () => {
      const { req, res } = createMockReqRes({
        query: { page: '2', limit: '15', search: 'alice', sortBy: 'interactions', sortOrder: 'desc', period: 'monthly', date: '2026-08' }
      });
      useCase.getAllUsers.mockResolvedValueOnce({ data: [], meta: { totalItems: 0, totalPages: 0, currentPage: 2, limit: 15 } });

      await controller.getAll(req, res);
      expect(useCase.getAllUsers).toHaveBeenCalledWith({
        page: 2,
        limit: 15,
        search: 'alice',
        sortBy: 'interactions',
        sortOrder: 'desc',
        period: 'monthly',
        date: '2026-08'
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('getAll should handle errors and respond with 500', async () => {
      const { req, res } = createMockReqRes();
      useCase.getAllUsers.mockRejectedValueOnce(new Error('DB Error'));

      await controller.getAll(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch users' });
    });

    it('getById should return 404 if user is not found', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'u_unknown' } });
      useCase.getUserById.mockResolvedValueOnce(null);

      await controller.getById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('getById should return user if found', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'u1' } });
      useCase.getUserById.mockResolvedValueOnce({ id: 'u1', handle: 'alice' } as any);

      await controller.getById(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 'u1', handle: 'alice' });
    });

    it('getById should handle error with 500', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'u1' } });
      useCase.getUserById.mockRejectedValueOnce(new Error('DB Error'));

      await controller.getById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('updateMemory should update memory and return success', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'u1' }, body: { coreProfile: '{"key":"val"}' } });
      useCase.updateUserMemory.mockResolvedValueOnce(undefined);

      await controller.updateMemory(req, res);
      expect(useCase.updateUserMemory).toHaveBeenCalledWith('u1', '{"key":"val"}');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('bulkUpdateStatus should handle ACTIVE, BLOCKED, MUTED and invalid status', async () => {
      // Invalid params (not an array)
      const { req: reqInvalid, res: resInvalid } = createMockReqRes({ body: { ids: 'not-array', status: 'ACTIVE' } });
      await controller.bulkUpdateStatus(reqInvalid, resInvalid);
      expect(resInvalid.status).toHaveBeenCalledWith(400);

      // Invalid status value
      const { req: reqBadStatus, res: resBadStatus } = createMockReqRes({ body: { ids: ['u1'], status: 'UNKNOWN' } });
      await controller.bulkUpdateStatus(reqBadStatus, resBadStatus);
      expect(resBadStatus.status).toHaveBeenCalledWith(400);

      // Valid BLOCKED
      const { req: reqBlocked, res: resBlocked } = createMockReqRes({ body: { ids: ['u1'], status: 'BLOCKED' } });
      await controller.bulkUpdateStatus(reqBlocked, resBlocked);
      expect(useCase.bulkUpdateStatus).toHaveBeenCalledWith(['u1'], UserStatus.BLOCKED);

      // Valid MUTED
      const { req: reqMuted, res: resMuted } = createMockReqRes({ body: { ids: ['u1'], status: 'MUTED' } });
      await controller.bulkUpdateStatus(reqMuted, resMuted);
      expect(useCase.bulkUpdateStatus).toHaveBeenCalledWith(['u1'], UserStatus.MUTED);

      // Valid ACTIVE
      const { req: reqActive, res: resActive } = createMockReqRes({ body: { ids: ['u1'], status: 'ACTIVE' } });
      await controller.bulkUpdateStatus(reqActive, resActive);
      expect(useCase.bulkUpdateStatus).toHaveBeenCalledWith(['u1'], UserStatus.ACTIVE);
    });
  });

  describe('AssetsController', () => {
    let useCase: jest.Mocked<AssetsUseCase>;
    let controller: AssetsController;

    beforeEach(() => {
      useCase = {
        getPaginatedAssets: jest.fn(),
        getAssetById: jest.fn(),
        uploadImages: jest.fn(),
        updateAsset: jest.fn(),
        deleteAssets: jest.fn(),
        regenerateCaptions: jest.fn()
      } as unknown as jest.Mocked<AssetsUseCase>;
      controller = new AssetsController(useCase);
    });

    it('getAll should return paginated assets and handle errors', async () => {
      const { req, res } = createMockReqRes({ query: { page: '1', limit: '10', search: 'cat', status: 'SUCCESS' } });
      useCase.getPaginatedAssets.mockResolvedValueOnce({ data: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } });

      await controller.getAll(req, res);
      expect(useCase.getPaginatedAssets).toHaveBeenCalledWith({ page: 1, limit: 10, search: 'cat', status: 'SUCCESS' });
      expect(res.json).toHaveBeenCalled();

      // Error branch
      const { req: reqErr, res: resErr } = createMockReqRes();
      useCase.getPaginatedAssets.mockRejectedValueOnce(new Error('err'));
      await controller.getAll(reqErr, resErr);
      expect(resErr.status).toHaveBeenCalledWith(500);
    });

    it('getById should return asset or 404 or 500', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'a1' } });
      useCase.getAssetById.mockResolvedValueOnce(null);
      await controller.getById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);

      useCase.getAssetById.mockResolvedValueOnce({ id: 'a1' } as any);
      await controller.getById(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 'a1' });

      useCase.getAssetById.mockRejectedValueOnce(new Error('err'));
      await controller.getById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('upload should support multer files array, single multer file, base64 json, and empty 400', async () => {
      // 1. Empty files
      const { req: reqEmpty, res: resEmpty } = createMockReqRes({ body: {} });
      await controller.upload(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      // 2. Multer array
      const mockMulterFile = { originalname: 'test.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('abc') };
      const { req: reqArray, res: resArray } = createMockReqRes({ files: [mockMulterFile] });
      useCase.uploadImages.mockResolvedValueOnce([{ id: 'img_1' } as any]);
      await controller.upload(reqArray, resArray);
      expect(resArray.status).toHaveBeenCalledWith(201);

      // 3. Single multer file
      const { req: reqSingle, res: resSingle } = createMockReqRes({ file: mockMulterFile });
      useCase.uploadImages.mockResolvedValueOnce([{ id: 'img_1' } as any]);
      await controller.upload(reqSingle, resSingle);
      expect(resSingle.status).toHaveBeenCalledWith(201);

      // 4. Base64 json payload
      const { req: reqB64, res: resB64 } = createMockReqRes({
        body: { files: [{ filename: 'b64.png', data: 'data:image/png;base64,ZmFrZQ==' }] }
      });
      useCase.uploadImages.mockResolvedValueOnce([{ id: 'img_b64' } as any]);
      await controller.upload(reqB64, resB64);
      expect(resB64.status).toHaveBeenCalledWith(201);

      // 5. Upload error catch
      const { req: reqErr, res: resErr } = createMockReqRes({ file: mockMulterFile });
      useCase.uploadImages.mockRejectedValueOnce(new Error('Upload failed'));
      await controller.upload(reqErr, resErr);
      expect(resErr.status).toHaveBeenCalledWith(500);
    });

    it('update should update asset and handle errors', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'a1' }, body: { caption: 'new caption' } });
      await controller.update(req, res);
      expect(useCase.updateAsset).toHaveBeenCalledWith('a1', { caption: 'new caption' });
      expect(res.json).toHaveBeenCalledWith({ success: true });

      useCase.updateAsset.mockRejectedValueOnce(new Error('err'));
      await controller.update(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('deleteMany should validate ids and delete', async () => {
      const { req: reqEmpty, res: resEmpty } = createMockReqRes({ body: {} });
      await controller.deleteMany(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      const { req, res } = createMockReqRes({ body: { ids: ['a1', 'a2'] } });
      await controller.deleteMany(req, res);
      expect(useCase.deleteAssets).toHaveBeenCalledWith(['a1', 'a2']);
      expect(res.json).toHaveBeenCalledWith({ success: true });

      useCase.deleteAssets.mockRejectedValueOnce(new Error('err'));
      await controller.deleteMany(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('regenerateCaptions should validate ids and call useCase', async () => {
      const { req: reqEmpty, res: resEmpty } = createMockReqRes({ body: {} });
      await controller.regenerateCaptions(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      const { req, res } = createMockReqRes({ body: { ids: ['a1'] } });
      await controller.regenerateCaptions(req, res);
      expect(useCase.regenerateCaptions).toHaveBeenCalledWith(['a1']);
      expect(res.json).toHaveBeenCalledWith({ success: true });

      useCase.regenerateCaptions.mockRejectedValueOnce(new Error('err'));
      await controller.regenerateCaptions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('TimelineController', () => {
    let useCase: jest.Mocked<TimelineUseCase>;
    let controller: TimelineController;

    beforeEach(() => {
      useCase = {
        getMetrics: jest.fn(),
        getPosts: jest.fn(),
        getPostById: jest.fn(),
        deletePosts: jest.fn(),
        getAlerts: jest.fn()
      } as unknown as jest.Mocked<TimelineUseCase>;
      controller = new TimelineController(useCase);
    });

    it('getMetrics should return metrics and handle error', async () => {
      const { req, res } = createMockReqRes({ query: { period: 'yearly' } });
      useCase.getMetrics.mockResolvedValueOnce({ followers: 100 } as any);
      await controller.getMetrics(req, res);
      expect(useCase.getMetrics).toHaveBeenCalledWith('yearly');

      useCase.getMetrics.mockRejectedValueOnce(new Error('err'));
      await controller.getMetrics(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('getPosts should parse query params and handle error', async () => {
      const { req, res } = createMockReqRes({ query: { page: '2', limit: '20', sortBy: 'impressions', sortOrder: 'asc', period: 'monthly', date: '2026-08' } });
      useCase.getPosts.mockResolvedValueOnce({ data: [], meta: { totalItems: 0, totalPages: 0, currentPage: 2, limit: 20 } });
      await controller.getPosts(req, res);
      expect(useCase.getPosts).toHaveBeenCalledWith({ page: 2, limit: 20, sortBy: 'impressions', sortOrder: 'asc', period: 'monthly', date: '2026-08' });

      useCase.getPosts.mockRejectedValueOnce(new Error('err'));
      await controller.getPosts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('getPostById should return post and handle error', async () => {
      const { req, res } = createMockReqRes({ params: { id: 'p1' } });
      useCase.getPostById.mockResolvedValueOnce({ id: 'p1' } as any);
      await controller.getPostById(req, res);
      expect(res.json).toHaveBeenCalledWith({ id: 'p1' });

      useCase.getPostById.mockRejectedValueOnce(new Error('err'));
      await controller.getPostById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('deletePosts should validate ids array and delete', async () => {
      const { req: reqInvalid, res: resInvalid } = createMockReqRes({ body: {} });
      await controller.deletePosts(reqInvalid, resInvalid);
      expect(resInvalid.status).toHaveBeenCalledWith(400);

      const { req, res } = createMockReqRes({ body: { ids: ['p1'] } });
      await controller.deletePosts(req, res);
      expect(useCase.deletePosts).toHaveBeenCalledWith(['p1']);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('getAlerts should return alerts and handle error', async () => {
      const { req, res } = createMockReqRes();
      useCase.getAlerts.mockResolvedValueOnce([]);
      await controller.getAlerts(req, res);
      expect(res.json).toHaveBeenCalledWith([]);

      useCase.getAlerts.mockRejectedValueOnce(new Error('err'));
      await controller.getAlerts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('SystemMemoryController', () => {
    let useCase: jest.Mocked<SystemMemoryUseCase>;
    let controller: SystemMemoryController;

    beforeEach(() => {
      useCase = {
        getLayers: jest.fn(),
        getCoreMemory: jest.fn(),
        getExtendedMemory: jest.fn(),
        updateExtendedMemory: jest.fn(),
        getGlobalMemory: jest.fn(),
        updateGlobalMemory: jest.fn(),
        triggerDreaming: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<SystemMemoryUseCase>;
      controller = new SystemMemoryController(useCase);
    });

    it('getLayers, getCoreMemory, getExtendedMemory, getGlobalMemory should return data', async () => {
      const { req, res } = createMockReqRes();
      useCase.getLayers.mockResolvedValueOnce([]);
      await controller.getLayers(req, res);
      expect(res.json).toHaveBeenCalledWith([]);

      useCase.getCoreMemory.mockResolvedValueOnce({ level: 0 } as any);
      await controller.getCoreMemory(req, res);
      expect(res.json).toHaveBeenCalledWith({ level: 0 });

      useCase.getExtendedMemory.mockResolvedValueOnce({ level: 1 } as any);
      await controller.getExtendedMemory(req, res);
      expect(res.json).toHaveBeenCalledWith({ level: 1 });

      useCase.getGlobalMemory.mockResolvedValueOnce({ level: 2 } as any);
      await controller.getGlobalMemory(req, res);
      expect(res.json).toHaveBeenCalledWith({ level: 2 });
    });

    it('getLayers, getCoreMemory, getExtendedMemory, getGlobalMemory should handle errors with 500', async () => {
      const { req, res } = createMockReqRes();
      useCase.getLayers.mockRejectedValueOnce(new Error('err'));
      await controller.getLayers(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      useCase.getCoreMemory.mockRejectedValueOnce(new Error('err'));
      await controller.getCoreMemory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      useCase.getExtendedMemory.mockRejectedValueOnce(new Error('err'));
      await controller.getExtendedMemory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);

      useCase.getGlobalMemory.mockRejectedValueOnce(new Error('err'));
      await controller.getGlobalMemory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('updateExtendedMemory and updateGlobalMemory should validate string and update', async () => {
      // Invalid content
      const { req: reqInvalid, res: resInvalid } = createMockReqRes({ body: {} });
      await controller.updateExtendedMemory(reqInvalid, resInvalid);
      expect(resInvalid.status).toHaveBeenCalledWith(400);

      await controller.updateGlobalMemory(reqInvalid, resInvalid);
      expect(resInvalid.status).toHaveBeenCalledWith(400);

      // Valid update
      const { req, res } = createMockReqRes({ body: { content: 'New memory' } });
      await controller.updateExtendedMemory(req, res);
      expect(useCase.updateExtendedMemory).toHaveBeenCalledWith('New memory');

      await controller.updateGlobalMemory(req, res);
      expect(useCase.updateGlobalMemory).toHaveBeenCalledWith('New memory');

      // Error branch for updateExtendedMemory
      useCase.updateExtendedMemory.mockRejectedValueOnce(new Error('err'));
      await controller.updateExtendedMemory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('triggerDreaming should invoke useCase and return 202', async () => {
      const { req, res } = createMockReqRes();
      await controller.triggerDreaming(req, res);
      expect(useCase.triggerDreaming).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Dreaming process initiated' });
    });
  });

  describe('CopilotController', () => {
    let useCase: jest.Mocked<CopilotUseCase>;
    let controller: CopilotController;

    beforeEach(() => {
      useCase = {
        processChat: jest.fn()
      } as unknown as jest.Mocked<CopilotUseCase>;
      controller = new CopilotController(useCase);
    });

    it('chat should require message parameter and handle processChat', async () => {
      const { req: reqEmpty, res: resEmpty } = createMockReqRes({ body: {} });
      await controller.chat(reqEmpty, resEmpty);
      expect(resEmpty.status).toHaveBeenCalledWith(400);

      const { req, res } = createMockReqRes({ body: { message: 'Hi', currentContext: 'Home', history: [] } });
      useCase.processChat.mockResolvedValueOnce({ reply: 'Hi Master!' } as any);
      await controller.chat(req, res);
      expect(useCase.processChat).toHaveBeenCalledWith({ message: 'Hi', currentContext: 'Home', history: [] });
      expect(res.json).toHaveBeenCalledWith({ reply: 'Hi Master!' });

      useCase.processChat.mockRejectedValueOnce(new Error('Copilot error'));
      await controller.chat(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('AuthController', () => {
    let controller: AuthController;

    beforeEach(() => {
      controller = new AuthController();
    });

    it('getMe should parse IAP header or fallback to admin email', () => {
      // With full IAP accounts header
      const { req: reqIap, res: resIap } = createMockReqRes({
        headers: { 'x-goog-authenticated-user-email': 'accounts.google.com:superadmin@company.com' }
      });
      controller.getMe(reqIap, resIap);
      expect(resIap.json).toHaveBeenCalledWith({ email: 'superadmin@company.com' });

      // With plain email header
      const { req: reqPlain, res: resPlain } = createMockReqRes({
        headers: { 'x-goog-authenticated-user-email': 'plain@company.com' }
      });
      controller.getMe(reqPlain, resPlain);
      expect(resPlain.json).toHaveBeenCalledWith({ email: 'plain@company.com' });

      // With no header
      const { req: reqNone, res: resNone } = createMockReqRes();
      controller.getMe(reqNone, resNone);
      expect(resNone.json).toHaveBeenCalledWith({ email: 'admin@example.com' });
    });
  });
});
