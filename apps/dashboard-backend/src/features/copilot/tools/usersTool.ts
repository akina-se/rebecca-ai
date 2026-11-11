import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotAttachment, UserDetail } from '@rebecca/types';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

/**
 * Tool for querying user profiles by handle, interaction rank, or moderation status.
 */
export class SearchUsersTool implements CopilotTool {
  readonly name = 'search_users';
  readonly description = 'Searches user profiles by handle/name prefix, account status (ACTIVE, BLOCKED, MUTED), and interaction rankings.';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Username or handle prefix to search for.'
        },
        status: {
          type: Type.STRING,
          description: 'Account status filter: ACTIVE, BLOCKED, MUTED, or ALL.',
          enum: ['ACTIVE', 'BLOCKED', 'MUTED', 'ALL']
        },
        sortBy: {
          type: Type.STRING,
          description: 'Field to sort users by: interactions, followersCount, or createdAt.',
          enum: ['interactions', 'followersCount', 'createdAt']
        },
        limit: {
          type: Type.INTEGER,
          description: 'Number of users to return (1 to 20, default is 5).'
        }
      }
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    if (!context.usersRepo) {
      return { data: { error: 'UsersRepository is not configured' } };
    }

    const limit = Math.max(1, Math.min(Number(params.limit) || 5, 20));
    const cleanQuery = typeof params.query === 'string' ? params.query.replace(/^@/, '').trim() : '';

    const result = await context.usersRepo.getAll({
      search: cleanQuery.length > 0 ? cleanQuery : undefined,
      limit,
      sortBy: typeof params.sortBy === 'string' ? params.sortBy : 'interactions',
      sortOrder: 'desc'
    });

    let users = result.data ?? [];
    if (typeof params.status === 'string' && params.status !== 'ALL') {
      const targetStatus = params.status;
      users = users.filter((u: UserDetail) => u.status === targetStatus);
    }

    // 1. Filter out orphan records that lack user identifiers (neither username nor name)
    const validUsers = users.filter((u: UserDetail) => Boolean(u.username || u.name));

    // 2. If a cleanQuery was provided, prioritize exact match over partial hits
    let candidateUsers = validUsers;
    if (cleanQuery.length > 0) {
      const exactMatch = validUsers.find(
        u => u.username?.toLowerCase() === cleanQuery.toLowerCase() ||
             u.id?.toLowerCase() === cleanQuery.toLowerCase() ||
             u.name?.toLowerCase() === cleanQuery.toLowerCase()
      );
      if (exactMatch) {
        candidateUsers = [exactMatch];
      }
    }

    const attachments: CopilotAttachment[] = candidateUsers.map((u: UserDetail) => ({
      type: 'user',
      id: u.id,
      title: u.name && u.name.length > 0
        ? (u.username ? `${u.name} (@${u.username})` : u.name)
        : (u.username ? `@${u.username}` : `User ${u.id}`),
      subtitle: u.username ? `@${u.username}` : u.id,
      statusBadge: u.status,
      metrics: {
        interactions: u.interactions
      },
      navigationPath: `/users?userId=${u.id}`
    }));

    const summary = candidateUsers.map((u: UserDetail) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      status: u.status,
      interactions: u.interactions,
      lastSeen: u.lastSeen
    }));

    return {
      data: {
        totalFound: users.length,
        users: summary
      },
      attachments
    };
  }
}
