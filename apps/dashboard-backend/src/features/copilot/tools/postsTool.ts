import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotAttachment, PostLeaderboard } from '@rebecca/types';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

/**
 * Tool for querying and ranking timeline posts by metrics.
 */
export class SearchTimelinePostsTool implements CopilotTool {
  readonly name = 'search_timeline_posts';
  readonly description = 'Searches and ranks timeline posts from the database by performance metrics (impressions, likes, replies, createdAt) across time periods.';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        sortBy: {
          type: Type.STRING,
          description: 'Metric to rank by: impressions, likes, replies, or createdAt. Default is impressions.',
          enum: ['impressions', 'likes', 'replies', 'createdAt']
        },
        sortOrder: {
          type: Type.STRING,
          description: 'Sort direction: desc or asc. Default is desc.',
          enum: ['desc', 'asc']
        },
        period: {
          type: Type.STRING,
          description: "Time window for posts. Accepts standard presets ('today', 'weekly', 'monthly', 'yearly', 'all-time') or custom relative durations (e.g. '7d', '14d', '30d', '90d', '2w', '3m', '1y'). Default is 'all-time'."
        },
        limit: {
          type: Type.INTEGER,
          description: 'Number of posts to return (1 to 20, default is 5).'
        }
      }
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    if (!context.timelineRepo) {
      return { data: { error: 'TimelineRepository is not configured' } };
    }

    const limit = Math.max(1, Math.min(Number(params.limit) || 5, 20));
    const sortBy = typeof params.sortBy === 'string' ? params.sortBy : 'impressions';
    const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
    const period = typeof params.period === 'string' ? params.period : 'all-time';

    const result = await context.timelineRepo.getPosts({
      sortBy,
      sortOrder,
      period,
      limit,
      page: 1
    });

    const posts = result.data ?? [];
    const attachments: CopilotAttachment[] = posts.map((p: PostLeaderboard) => {
      const firstMedia = Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0 ? p.mediaUrls[0] : undefined;
      return {
        type: 'post',
        id: p.id,
        title: p.snippet.length > 80 ? `${p.snippet.slice(0, 80)}...` : p.snippet,
        subtitle: p.time,
        imageUrl: firstMedia,
        thumbnailUrl: firstMedia,
        metrics: {
          impressions: p.impressions
        },
        navigationPath: `/dashboard?postId=${p.id}`
      };
    });

    const summary = posts.map((p: PostLeaderboard) => ({
      id: p.id,
      text: p.snippet,
      impressions: p.impressions,
      time: p.time
    }));

    return {
      data: {
        period,
        totalFound: posts.length,
        posts: summary
      },
      attachments
    };
  }
}
