import { Router } from 'express';
import { AuthController } from './controller';

/**
 * Initializes the auth feature module, setting up dependencies and routes.
 * 
 * @returns An Express Router configured with the auth routes.
 */
export function initializeAuthModule(): Router {
  const router = Router();
  const controller = new AuthController();

  router.get('/me', controller.getMe.bind(controller));

  return router;
}
