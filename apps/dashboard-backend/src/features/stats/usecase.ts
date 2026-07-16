import { IStatsRepository } from './repository';
import { DashboardStats } from './entities';

export class GetDashboardStatsUseCase {
  constructor(private readonly statsRepository: IStatsRepository) {}

  public async execute(): Promise<DashboardStats> {
    return await this.statsRepository.getLatestStats();
  }
}
