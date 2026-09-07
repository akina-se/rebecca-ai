import { Router } from 'express';
import { ProactiveAnniversaryController } from './controller';
import { ProactiveAnniversaryUseCase } from './usecase';
import { AppDependencies } from '../../types';
import { createProactiveAnniversaryRouter } from './routes';
import { IAnniversaryProvider } from './types';

export * from './types';
export * from './usecase';
export * from './controller';
export * from './routes';
export * from './providers/wikipedia';

/**
 * Creates and configures the router module for the Proactive Anniversary feature.
 *
 * @param deps Application dependencies required to instantiate use cases and controllers.
 * @param provider Optional custom anniversary provider (defaults to WikipediaAnniversaryProvider).
 * @returns An Express Router instance configured with anniversary-related routes.
 */
export const createProactiveAnniversaryModule = (
  deps: AppDependencies,
  provider?: IAnniversaryProvider,
): Router => {
  const useCase = new ProactiveAnniversaryUseCase(deps, provider);
  const controller = new ProactiveAnniversaryController(useCase);
  return createProactiveAnniversaryRouter(controller);
};
