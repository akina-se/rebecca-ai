import { AssetEmbeddingsUseCase } from '../../src/features/assets/usecase';
import { AssetEmbeddingsController } from '../../src/features/assets/controller';
import { createAssetEmbeddingsRouter, createAssetEmbeddingsModule } from '../../src/features/assets';
import { createMockDeps } from './core/testUtils';
import { Request, Response } from 'express';

describe('Asset Embeddings Batch', () => {
  let deps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
  });

  describe('AssetEmbeddingsUseCase', () => {
    it('should complete with zero counts when no assets are pending embeddings', async () => {
      deps.firestore.getAssetsPendingEmbedding.mockResolvedValueOnce([]);

      const useCase = new AssetEmbeddingsUseCase(deps);
      const result = await useCase.execute();

      expect(result).toEqual({
        status: 'success',
        processed: 0,
        failed: 0,
        totalPending: 0,
      });
      expect(deps.gemini.generateEmbedding).not.toHaveBeenCalled();
      expect(deps.firestore.updateAssetEmbedding).not.toHaveBeenCalled();
    });

    it('should generate embeddings and update firestore for pending assets', async () => {
      deps.firestore.getAssetsPendingEmbedding.mockResolvedValueOnce([
        { id: 'img_001', caption: '笑顔のレベッカ' },
        { id: 'img_002', caption: '夕焼け空とビル街' },
      ]);
      const mockVector1 = new Array(768).fill(0.1);
      const mockVector2 = new Array(768).fill(0.2);
      deps.gemini.generateEmbedding
        .mockResolvedValueOnce(mockVector1)
        .mockResolvedValueOnce(mockVector2);

      const useCase = new AssetEmbeddingsUseCase(deps);
      const result = await useCase.execute();

      expect(result).toEqual({
        status: 'success',
        processed: 2,
        failed: 0,
        totalPending: 2,
      });
      expect(deps.gemini.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(deps.firestore.updateAssetEmbedding).toHaveBeenCalledWith('img_001', mockVector1);
      expect(deps.firestore.updateAssetEmbedding).toHaveBeenCalledWith('img_002', mockVector2);
    });

    it('should handle Gemini empty vector and exceptions gracefully without aborting remaining items', async () => {
      deps.firestore.getAssetsPendingEmbedding.mockResolvedValueOnce([
        { id: 'img_fail_empty', caption: '空ベクトルが返る' },
        { id: 'img_fail_error', caption: 'エラーが起きる' },
        { id: 'img_success', caption: '成功する' },
      ]);
      const mockVector = new Array(768).fill(0.5);
      deps.gemini.generateEmbedding
        .mockResolvedValueOnce([]) // empty
        .mockRejectedValueOnce(new Error('Rate limit exceeded')) // throws
        .mockResolvedValueOnce(mockVector); // succeeds

      const useCase = new AssetEmbeddingsUseCase(deps);
      const result = await useCase.execute();

      expect(result).toEqual({
        status: 'success',
        processed: 1,
        failed: 2,
        totalPending: 3,
      });
      expect(deps.firestore.updateAssetEmbedding).toHaveBeenCalledTimes(1);
      expect(deps.firestore.updateAssetEmbedding).toHaveBeenCalledWith('img_success', mockVector);
    });

    it('should rethrow errors if getAssetsPendingEmbedding fails', async () => {
      deps.firestore.getAssetsPendingEmbedding.mockRejectedValueOnce(new Error('Firestore connection failed'));

      const useCase = new AssetEmbeddingsUseCase(deps);
      await expect(useCase.execute()).rejects.toThrow('Firestore connection failed');
    });
  });

  describe('AssetEmbeddingsController', () => {
    it('should respond with 200 and result on success', async () => {
      const mockUseCase = {
        execute: jest.fn().mockResolvedValue({ status: 'success', processed: 1, failed: 0, totalPending: 1 }),
      } as unknown as AssetEmbeddingsUseCase;

      const controller = new AssetEmbeddingsController(mockUseCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', processed: 1, failed: 0, totalPending: 1 });
    });

    it('should respond with 500 when usecase throws', async () => {
      const mockUseCase = {
        execute: jest.fn().mockRejectedValue(new Error('Fatal batch error')),
      } as unknown as AssetEmbeddingsUseCase;

      const controller = new AssetEmbeddingsController(mockUseCase);
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.handle(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('createAssetEmbeddingsModule & Router', () => {
    it('should configure GET and POST routes properly', () => {
      const router = createAssetEmbeddingsModule(deps);
      expect(router).toBeDefined();

      const controller = new AssetEmbeddingsController({ execute: jest.fn() } as any);
      const configuredRouter = createAssetEmbeddingsRouter(controller);
      expect(configuredRouter).toBeDefined();
    });
  });
});
