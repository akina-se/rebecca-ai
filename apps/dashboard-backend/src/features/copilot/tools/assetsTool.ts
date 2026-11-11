import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { Asset, CopilotAttachment } from '@rebecca/types';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';
import { logger } from '../../../utils/logger';
import { config } from '../../../config';

/**
 * Tool for semantic vector search and status filtering of media image assets.
 */
export class SearchAssetsTool implements CopilotTool {
  readonly name = 'search_assets';
  readonly description = 'Searches image assets using natural language semantic vector search against caption embeddings, or filters assets by processing status (e.g. FAILED).';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        semanticQuery: {
          type: Type.STRING,
          description: 'Natural language description of the visual scene to find (e.g., "cyberpunk neon street", "eating sweets", "relaxing at a cafe").'
        },
        status: {
          type: Type.STRING,
          description: 'Filter by asset processing status: PENDING, PROCESSING, SUCCESS, FAILED, or ALL.',
          enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'ALL']
        },
        limit: {
          type: Type.INTEGER,
          description: 'Number of assets to return (1 to 10, default is 5).'
        }
      }
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    if (!context.assetsRepo) {
      return { data: { error: 'AssetsRepository is not configured' } };
    }

    const limit = Math.max(1, Math.min(Number(params.limit) || 5, 10));
    const semanticQuery = typeof params.semanticQuery === 'string' ? params.semanticQuery.trim() : '';
    let matchedAssets: Asset[] = [];

    // 1. Semantic Vector Search if semanticQuery is provided
    if (semanticQuery.length > 0 && config.gemini.apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
        const embedRes = await ai.models.embedContent({
          model: config.gemini.embeddingModel,
          contents: semanticQuery,
          config: { outputDimensionality: 768 }
        });
        const vector = embedRes.embeddings?.[0]?.values;
        if (Array.isArray(vector) && vector.length > 0) {
          matchedAssets = await context.assetsRepo.findByVector(vector, limit);
        }
      } catch (err) {
        logger.warn('Failed vector embedding calculation for asset search, falling back to text search', {
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // 2. Keyword fallback or status query if vector search returned no candidates
    if (matchedAssets.length === 0) {
      const paginated = await context.assetsRepo.getPaginated({
        search: semanticQuery.length > 0 ? semanticQuery : undefined,
        status: typeof params.status === 'string' && params.status !== 'ALL' ? params.status : undefined,
        limit,
        page: 1
      });
      matchedAssets = paginated.data ?? [];
    } else if (typeof params.status === 'string' && params.status !== 'ALL') {
      const targetStatus = params.status;
      matchedAssets = matchedAssets.filter((a: Asset) => a.status === targetStatus);
    }

    const finalAssets = matchedAssets.slice(0, limit);

    const attachments: CopilotAttachment[] = finalAssets.map((a: Asset) => ({
      type: 'image',
      id: a.id,
      title: a.filename || a.id,
      subtitle: a.caption || (a.status === 'FAILED' ? 'Caption generation failed' : ''),
      imageUrl: a.url,
      thumbnailUrl: a.thumbnailUrl ?? a.url,
      statusBadge: a.status,
      navigationPath: `/assets?assetId=${a.id}`
    }));

    const summary = finalAssets.map((a: Asset) => ({
      id: a.id,
      filename: a.filename,
      caption: a.caption,
      status: a.status,
      thumbnailUrl: a.thumbnailUrl ?? a.url
    }));

    return {
      data: {
        totalFound: finalAssets.length,
        assets: summary
      },
      attachments
    };
  }
}
