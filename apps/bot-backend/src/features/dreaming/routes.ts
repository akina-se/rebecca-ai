import { Router } from 'express';
import { GlobalDreamingController } from './controller';

/**
 * Configures the HTTP routing for the global dreaming module.
 * 
 * Maps incoming HTTP endpoints to their corresponding controller actions.
 * 
 * @param controller - The instantiated GlobalDreamingController to handle matched routes.
 * @returns An Express Router configured with the dreaming endpoints.
 */
export const createGlobalDreamingRouter = (controller: GlobalDreamingController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};