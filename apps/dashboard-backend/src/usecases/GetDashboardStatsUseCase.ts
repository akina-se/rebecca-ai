import { IStatsRepository } from '../domain/repositories/IStatsRepository';
import { DashboardStats } from '../domain/entities/DashboardStats';

/**
 * Use Case: Get Dashboard Stats
 * 
 * Contains application-specific business rules.
 * Uses constructor injection to receive the repository implementation.
 */
export class GetDashboardStatsUseCase {
  constructor(private readonly statsRepository: IStatsRepository) {}

  public async execute(): Promise<DashboardStats> {
    // Here we could add business logic, logging, or data transformation
    // specific to the application before returning to the presenter/controller.
    return await this.statsRepository.getLatestStats();
  }
}
