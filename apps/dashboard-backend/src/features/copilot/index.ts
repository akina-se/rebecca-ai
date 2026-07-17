import { Router } from 'express';
import { CopilotUseCase } from './usecase';
import { CopilotController } from './controller';

/**
 * Initializes the Copilot feature module, setting up dependencies and routes.
 * 
 * @returns An Express Router configured with the Copilot routes.
 */
export function initializeCopilotModule(): Router {
  const router = Router();
  
  const useCase = new CopilotUseCase();
  const controller = new CopilotController(useCase);

  router.post('/chat', controller.chat.bind(controller));

  return router;
}
