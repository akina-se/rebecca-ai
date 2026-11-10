import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

/**
 * Tool for retrieving high-level KPI metrics and system growth trends.
 */
export class GetKpiSummaryTool implements CopilotTool {
  readonly name = 'get_kpi_summary';
  readonly description = 'Retrieves high-level system KPI metrics (follower growth, engagement rate, DAU, API calls) and trends.';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: 'Time period for the KPI summary: weekly, monthly, or yearly. Default is monthly.',
          enum: ['weekly', 'monthly', 'yearly']
        }
      }
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    if (!context.timelineRepo) {
      return { data: { error: 'TimelineRepository is not configured' } };
    }

    const period = typeof params.period === 'string' ? params.period : 'monthly';
    const metrics = await context.timelineRepo.getMetrics(period);

    return {
      data: {
        period,
        followers: metrics.followers,
        followersTrendPercent: metrics.followersTrend,
        engagementRatePercent: metrics.engagementRate,
        engagementTrendPercent: metrics.engagementTrend,
        dailyActiveUsers: metrics.dailyActiveUsers,
        dauTrendPercent: metrics.dauTrend,
        apiCallsTotal: metrics.apiCalls,
        apiCallsTrendPercent: metrics.apiCallsTrend
      }
    };
  }
}
