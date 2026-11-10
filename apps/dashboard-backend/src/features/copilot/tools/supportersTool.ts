import { FunctionDeclaration, Type } from '@google/genai';
import { SupportTransactionDoc } from '@rebecca/types';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

/**
 * Tool for inspecting supporter transactions and fan club metrics.
 */
export class SearchSupportersTool implements CopilotTool {
  readonly name = 'search_supporters';
  readonly description = 'Retrieves supporter ledger metrics, transaction counts, and digital reward catalog status.';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.INTEGER,
          description: 'Number of recent supporter records to inspect (1 to 20, default is 5).'
        }
      }
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    if (!context.supportersRepo) {
      return { data: { error: 'SupportersRepository is not configured' } };
    }

    const limit = Math.max(1, Math.min(Number(params.limit) || 5, 20));
    const ledger = await context.supportersRepo.getTransactions({ limit });

    return {
      data: {
        summary: ledger.summary,
        recentCount: ledger.transactions.length,
        recentSupporters: ledger.transactions.map((item: SupportTransactionDoc) => ({
          id: item.id,
          supporterName: item.safeName || item.rawName,
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          date: item.createdAt
        }))
      }
    };
  }
}
