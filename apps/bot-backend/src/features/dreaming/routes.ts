import { Router } from 'express';
import { GlobalDreamingController } from './controller';

/**
 * Creates and configures the Express router for global dreaming operations.
 * 
 * @param controller - The controller that will handle the route requests.
 * @returns A configured Express Router instance.
 */
export const createGlobalDreamingRouter = (controller: GlobalDreamingController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};