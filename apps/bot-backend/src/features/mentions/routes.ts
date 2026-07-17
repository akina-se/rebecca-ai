import { Router } from 'express';
import { MentionsController } from './controller';

/**
 * Configures the Express routes for the Mentions feature.
 * @param controller The MentionsController instance to handle route requests.
 * @returns An Express Router configured with mentions endpoints.
 */
export const createMentionsRouter = (controller: MentionsController): Router => {
    const router = Router();
    
    // The authentication middleware (batchAuth) should be applied globally 
    // to the parent router mapping this module, or passed in here.
    // For clean architecture, we just define the routes here.
    
    router.get('/', controller.pollMentions);
    
    return router;
};
