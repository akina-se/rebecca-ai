import { Router } from 'express';
import { MentionsController } from './controller';
import { PollMentionsUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createMentionsRouter } from './routes';

/**
 * Creates and configures the router module for the Mentions feature.
 * @param deps The application dependencies required to instantiate the use cases and controllers.
 * @returns An Express Router instance configured with mention-related routes.
 */
export const createMentionsModule = (deps: AppDependencies): Router => {
    const useCase = new PollMentionsUseCase(deps);
    const controller = new MentionsController(useCase);
    return createMentionsRouter(controller);
};
