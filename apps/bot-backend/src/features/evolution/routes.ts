import { Router } from 'express';
import { GlobalEvolutionController } from './controller';

/**
 * Creates and configures the Express router for global evolution operations.
 * Sets up the HTTP endpoints and binds them to the corresponding controller methods.
 * 
 * @param controller - The controller instance handling the route logic.
 * @returns A fully configured Express Router instance ready to be mounted.
 */
export const createGlobalEvolutionRouter = (controller: GlobalEvolutionController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};