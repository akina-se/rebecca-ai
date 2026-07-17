import { Router } from 'express';
import { RandomEngagementController } from './controller';

/**
 * Creates and configures the Express router for random engagement operations.
 * 
 * @param controller - The controller handling the route logic.
 * @returns A configured Express Router instance.
 */
export const createRandomEngagementRouter = (controller: RandomEngagementController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};