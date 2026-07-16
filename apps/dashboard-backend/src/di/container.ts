import { FirestoreStatsRepository } from '../infrastructure/firestore/FirestoreStatsRepository';
import { GetDashboardStatsUseCase } from '../usecases/GetDashboardStatsUseCase';
import { DashboardController } from '../interfaces/controllers/DashboardController';
import { createDashboardRouter } from '../interfaces/routes/dashboardRoutes';
import { Router } from 'express';

/**
 * Dependency Injection Container
 * Manages the instantiation and wiring of dependencies for the entire application.
 */
export class DIContainer {
  public readonly dashboardRouter: Router;

  constructor() {
    // 1. Instantiate Infrastructure (Repositories)
    // If we later switch to Kafka/ClickHouse CQRS, we just swap this line.
    const statsRepository = new FirestoreStatsRepository();

    // 2. Instantiate Use Cases (Domain logic depends on interfaces, not implementations)
    const getDashboardStatsUseCase = new GetDashboardStatsUseCase(statsRepository);

    // 3. Instantiate Controllers (Interfaces)
    const dashboardController = new DashboardController(getDashboardStatsUseCase);

    // 4. Create and wire Routers
    this.dashboardRouter = createDashboardRouter(dashboardController);
  }
}
