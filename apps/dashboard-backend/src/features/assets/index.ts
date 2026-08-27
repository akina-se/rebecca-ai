import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import multer from 'multer';
import { AssetsRepository } from './repository';
import { AssetsUseCase } from './usecase';
import { AssetsController } from './controller';

// Configure multer with in-memory storage for handling multipart/form-data uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max per image
    files: 20 // Up to 20 files per upload batch
  }
});

/**
 * Initializes the assets feature module, setting up dependencies and routes.
 * 
 * @param firestore - The Firestore instance used for database operations.
 * @returns An object containing the protected assets router and public image streaming router.
 */
export function initializeAssetsModule(firestore: Firestore): { assetsRouter: Router; publicImagesRouter: Router } {
  const assetsRouter = Router();
  const publicImagesRouter = Router();
  
  const repo = new AssetsRepository(firestore);
  const useCase = new AssetsUseCase(repo);
  const controller = new AssetsController(useCase);

  // Public image streaming endpoint (no auth required for browser <img> / css requests)
  publicImagesRouter.get('/:id/image', controller.getImage.bind(controller));

  // 1. List / Query Assets (Paginated with search)
  assetsRouter.get('/', controller.getAll.bind(controller));

  // 2. Action endpoints (registered before :id parameterized routes)
  assetsRouter.post('/regenerate-captions', controller.regenerateCaptions.bind(controller));
  
  // 3. Multi-file upload endpoint (supports multipart/form-data with field 'files' or single 'file')
  assetsRouter.post('/', upload.array('files', 20), controller.upload.bind(controller));

  // 4. Single Asset CRUD & streaming endpoints
  assetsRouter.get('/:id/image', controller.getImage.bind(controller));
  assetsRouter.get('/:id', controller.getById.bind(controller));
  assetsRouter.put('/:id', controller.update.bind(controller));
  assetsRouter.delete('/:id', controller.deleteMany.bind(controller));
  assetsRouter.delete('/', controller.deleteMany.bind(controller));

  return { assetsRouter, publicImagesRouter };
}
