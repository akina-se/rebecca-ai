import { Request, Response } from 'express';
import { GetDashboardStatsUseCase } from '../../usecases/GetDashboardStatsUseCase';

export class DashboardController {
  constructor(private readonly getDashboardStatsUseCase: GetDashboardStatsUseCase) {}

  /**
   * Express request handler for getting stats.
   * Bound to instance using arrow function to preserve 'this' context.
   */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.getDashboardStatsUseCase.execute();
      res.status(200).json(stats);
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
}
