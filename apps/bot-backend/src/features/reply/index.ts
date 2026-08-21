import { Router } from 'express';
import { ReplyTaskController } from './controller';
import { ReplyTaskUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createReplyTaskRouter } from './routes';

/**
 * Creates and configures the reply task module router.
 * 
 * @param deps The application dependencies.
 * @returns The configured Express Router for the reply task module.
 */
export const createReplyTaskModule = (deps: AppDependencies): Router => {
    const useCase = new ReplyTaskUseCase(deps);
    const controller = new ReplyTaskController(useCase);
    return createReplyTaskRouter(controller);
};