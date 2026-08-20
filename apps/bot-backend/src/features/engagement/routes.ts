import { Router } from 'express';
import { RandomEngagementController } from './controller';

/**
 * Constructs and configures the Express router for random engagement endpoints.
 * 
 * @param controller - The controller instance responsible for handling route logic.
 * @returns A configured Express Router instance defining the HTTP routes for engagement.
 */
export const createRandomEngagementRouter = (controller: RandomEngagementController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};