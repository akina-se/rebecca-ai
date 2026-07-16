import { Request, Response } from 'express';
import { GetDashboardStatsUseCase } from './usecase';

export class StatsController {
  constructor(private readonly getStatsUseCase: GetDashboardStatsUseCase) {}

  public getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.getStatsUseCase.execute();
      res.status(200).json(stats);
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
