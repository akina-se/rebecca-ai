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
 * @returns An Express Router configured with the assets routes.
 */
export function initializeAssetsModule(firestore: Firestore): Router {
  const router = Router();
  
  const repo = new AssetsRepository(firestore);
  const useCase = new AssetsUseCase(repo);
  const controller = new AssetsController(useCase);

  // 1. List / Query Assets (Paginated with search)
  router.get('/', controller.getAll.bind(controller));

  // 2. Action endpoints (registered before :id parameterized routes)
  router.post('/regenerate-captions', controller.regenerateCaptions.bind(controller));
  
  // 3. Multi-file upload endpoint (supports multipart/form-data with field 'files' or single 'file')
  router.post('/', upload.array('files', 20), controller.upload.bind(controller));

  // 4. Single Asset CRUD & streaming endpoints
  router.get('/:id/image', controller.getImage.bind(controller));
  router.get('/:id', controller.getById.bind(controller));
  router.put('/:id', controller.update.bind(controller));
  router.delete('/', controller.deleteMany.bind(controller));

  return router;
}
