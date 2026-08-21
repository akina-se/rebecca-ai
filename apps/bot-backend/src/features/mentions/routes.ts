import { Router } from 'express';
import { MentionsController } from './controller';

/**
 * Initializes and configures the Express routes for the Mentions sub-domain.
 * 
 * @param controller - The controller instance responsible for handling route logic.
 * @returns A configured Express Router instance containing endpoints for mentions operations.
 */
export const createMentionsRouter = (controller: MentionsController): Router => {
    const router = Router();
    
    router.get('/', controller.pollMentions);
    
    return router;
};
