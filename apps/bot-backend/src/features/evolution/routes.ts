import { Router } from 'express';
import { GlobalEvolutionController } from './controller';

/**
 * Creates and configures the Express router for global evolution operations.
 * 
 * @param controller - The controller handling the route logic.
 * @returns A configured Express Router instance.
 */
export const createGlobalEvolutionRouter = (controller: GlobalEvolutionController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};