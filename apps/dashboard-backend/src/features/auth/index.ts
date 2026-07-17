import { Router } from 'express';
import { AuthController } from './controller';

export function initializeAuthModule(): Router {
  const router = Router();
  const controller = new AuthController();

  router.get('/me', controller.getMe.bind(controller));

  return router;
}
