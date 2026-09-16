import { Router } from 'express';
import config from '../../config';
import { ProactiveAnniversaryController } from './controller';
import { ProactiveAnniversaryUseCase } from './usecase';
import { SoliloquyUseCase } from '../soliloquy';
import { AppDependencies } from '../../types';
import { createProactiveAnniversaryRouter } from './routes';
import { WikipediaAnniversaryProvider } from './providers/wikipedia';

export * from './types';
export * from './usecase';
export * from './controller';
export * from './routes';
export * from './providers/wikipedia';

/**
 * Creates and configures the router module for the Proactive Anniversary feature.
 *
 * @param deps Application dependencies required to instantiate use cases and controllers.
 * @returns An Express Router instance configured with anniversary-related routes.
 */
export const createProactiveAnniversaryModule = (
  deps: AppDependencies,
): Router => {
  const anniversaryProvider = new WikipediaAnniversaryProvider(
    deps.persona.metadata.userAgent,
    config.appTimezone,
  );
  const useCase = new ProactiveAnniversaryUseCase(deps, anniversaryProvider);
  const soliloquyUseCase = new SoliloquyUseCase(deps, { timezone: config.appTimezone });
  const controller = new ProactiveAnniversaryController(useCase, soliloquyUseCase);
  return createProactiveAnniversaryRouter(controller);
};
