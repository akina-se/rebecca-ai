import { Router } from 'express';
import { ProactiveNewsController } from './controller';
import { ProactiveNewsUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createProactiveNewsRouter } from './routes';

/**
 * Creates and configures the router module for the Proactive News feature.
 * @param deps The application dependencies required to instantiate the use cases and controllers.
 * @returns An Express Router instance configured with news-related routes.
 */
export const createProactiveNewsModule = (deps: AppDependencies): Router => {
    const useCase = new ProactiveNewsUseCase(deps);
    const controller = new ProactiveNewsController(useCase);
    return createProactiveNewsRouter(controller);
};