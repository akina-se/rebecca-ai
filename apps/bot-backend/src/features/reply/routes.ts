import { Router } from 'express';
import { ReplyTaskController } from './controller';

/**
 * Creates the router for reply task endpoints.
 * 
 * @param controller The controller to handle reply task requests.
 * @returns The Express Router configured with reply task routes.
 */
export const createReplyTaskRouter = (controller: ReplyTaskController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};