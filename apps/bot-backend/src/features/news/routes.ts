import { Router } from 'express';
import { ProactiveNewsController } from './controller';

/**
 * Configures the Express routes for the Proactive News feature.
 * @param controller The ProactiveNewsController instance to handle route requests.
 * @returns An Express Router configured with proactive news endpoints.
 */
export const createProactiveNewsRouter = (controller: ProactiveNewsController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};