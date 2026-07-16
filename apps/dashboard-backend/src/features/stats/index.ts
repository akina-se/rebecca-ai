import { Firestore } from '@google-cloud/firestore';
import { FirestoreStatsRepository } from './infrastructure/firestore-repository';
import { GetDashboardStatsUseCase } from './usecase';
import { StatsController } from './controller';
import { createStatsRouter } from './routes';
import { Router } from 'express';

/**
 * Creates and wires up the entire Stats feature module.
 */
export function initializeStatsModule(firestore: Firestore): Router {
  const repository = new FirestoreStatsRepository(firestore);
  const useCase = new GetDashboardStatsUseCase(repository);
  const controller = new StatsController(useCase);
  return createStatsRouter(controller);
}

// Export domain types for external use if needed
export * from './entities';
export * from './repository';
