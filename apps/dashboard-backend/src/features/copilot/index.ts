import { Router } from 'express';
import { CopilotUseCase } from './usecase';
import { CopilotController } from './controller';

export function initializeCopilotModule(): Router {
  const router = Router();
  
  const useCase = new CopilotUseCase();
  const controller = new CopilotController(useCase);

  router.post('/chat', controller.chat.bind(controller));

  return router;
}
