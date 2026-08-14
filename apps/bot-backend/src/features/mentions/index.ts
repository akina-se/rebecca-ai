import { Router } from 'express';
import { MentionsController } from './controller';
import { PollMentionsUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createMentionsRouter } from './routes';

/**
 * Bootstraps and configures the Mentions feature module.
 * Instantiates necessary use cases and controllers, wiring them into an Express router.
 * 
 * @param deps - The centralized application dependencies required to instantiate use cases.
 * @returns A fully configured Express Router instance containing the mentions routes.
 */
export const createMentionsModule = (deps: AppDependencies): Router => {
    const useCase = new PollMentionsUseCase(deps);
    const controller = new MentionsController(useCase);
    return createMentionsRouter(controller);
};
