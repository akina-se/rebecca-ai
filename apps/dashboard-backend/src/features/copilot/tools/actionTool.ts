import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotAction, CopilotActionType, UserDetail } from '@rebecca/types';
import { CopilotTool, CopilotToolContext, CopilotToolExecutionResult } from '../types';

const VALID_ACTIONS = new Set<CopilotActionType>([
  'BLOCK_USER',
  'UNBLOCK_USER',
  'DELETE_POST',
  'FORCE_DREAMING',
  'REGENERATE_CAPTIONS'
]);

/**
 * Tool for proposing safety-gated administrative operations requiring explicit human confirmation.
 */
export class ProposeDestructiveActionTool implements CopilotTool {
  readonly name = 'propose_destructive_action';
  readonly description = 'Proposes a safety-gated administrative operation (BLOCK_USER, UNBLOCK_USER, DELETE_POST, FORCE_DREAMING, REGENERATE_CAPTIONS) requiring explicit confirmation from the operator. For BLOCK_USER and UNBLOCK_USER, you MUST FIRST investigate the account using search_users to obtain the exact username/ID before calling this function. If the target account does not exist in the database, this function returns an error.';

  readonly declaration: FunctionDeclaration = {
    name: this.name,
    description: this.description,
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionType: {
          type: Type.STRING,
          description: 'Type of administrative operation: BLOCK_USER, UNBLOCK_USER, DELETE_POST, FORCE_DREAMING, or REGENERATE_CAPTIONS.',
          enum: ['BLOCK_USER', 'UNBLOCK_USER', 'DELETE_POST', 'FORCE_DREAMING', 'REGENERATE_CAPTIONS']
        },
        targetId: {
          type: Type.STRING,
          description: 'Target identifier: exact verified user handle/ID for BLOCK/UNBLOCK (must be investigated with search_users first), postId for DELETE_POST, or empty for system actions.'
        },
        reason: {
          type: Type.STRING,
          description: 'Brief reason or summary of why this action is being proposed.'
        }
      },
      required: ['actionType']
    }
  };

  async execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult> {
    const isEn = context.isEn;
    const rawAction = typeof params.actionType === 'string' ? params.actionType.toUpperCase() : '';
    if (!VALID_ACTIONS.has(rawAction as CopilotActionType)) {
      return {
        data: { error: `Invalid action type: ${params.actionType}` }
      };
    }

    const actionType = rawAction as CopilotActionType;
    const cleanTarget = typeof params.targetId === 'string' ? params.targetId.trim() : '';

    let title = '';
    let description = '';
    let impactLevel: 'danger' | 'warning' | 'info' = 'warning';
    const payload: Record<string, unknown> = {};

    switch (actionType) {
      case 'BLOCK_USER':
      case 'UNBLOCK_USER': {
        let resolvedId = cleanTarget.replace(/^@/, '');
        let resolvedHandle = cleanTarget.startsWith('@') ? cleanTarget : `@${cleanTarget}`;
        let resolvedName = cleanTarget;

        if (cleanTarget && context.usersRepo) {
          let directUser: UserDetail | null = null;
          if (typeof context.usersRepo.getById === 'function') {
            try {
              directUser = await context.usersRepo.getById(resolvedId);
            } catch {
              directUser = null;
            }
          }

          if (directUser) {
            resolvedId = directUser.id;
            resolvedHandle = directUser.username ? `@${directUser.username}` : `@${directUser.id}`;
            resolvedName = directUser.name && directUser.name.length > 0 ? directUser.name : resolvedHandle;
          } else if (typeof context.usersRepo.getAll === 'function') {
            const searchRes = await context.usersRepo.getAll({ search: resolvedId, limit: 5 });
            const candidates = searchRes.data ?? [];
            if (candidates.length === 0) {
              return {
                data: {
                  error: isEn
                    ? `User "${cleanTarget}" was not found in the database. Please verify the account name with search_users first.`
                    : `ユーザー「${cleanTarget}」はデータベースに見つかりませんでした。事前にsearch_usersで正しいアカウント名を調査してください。`
                }
              };
            }
            const exactMatch = candidates.find(
              c => c.username?.toLowerCase() === resolvedId.toLowerCase() ||
                   c.id?.toLowerCase() === resolvedId.toLowerCase() ||
                   c.name?.toLowerCase() === resolvedId.toLowerCase()
            );

            if (exactMatch) {
              resolvedId = exactMatch.id;
              resolvedHandle = exactMatch.username ? `@${exactMatch.username}` : `@${exactMatch.id}`;
              resolvedName = exactMatch.name && exactMatch.name.length > 0 ? exactMatch.name : resolvedHandle;
            }
          }
        }

        const hasDistinctName = Boolean(
          resolvedName &&
          resolvedName !== resolvedHandle &&
          resolvedName.toLowerCase() !== resolvedId.toLowerCase() &&
          resolvedName.toLowerCase() !== resolvedHandle.replace(/^@/, '').toLowerCase()
        );

        const userLabel = hasDistinctName
          ? `${resolvedName} (${resolvedHandle})`
          : cleanTarget;

        if (actionType === 'BLOCK_USER') {
          impactLevel = 'danger';
          title = isEn
            ? (userLabel ? `Block User ${userLabel}` : 'Block User')
            : (userLabel ? `ユーザー ${userLabel} のブロック` : 'ユーザーのブロック');
          description = isEn
            ? (userLabel ? `Block ${userLabel} from interacting with the bot or replying.` : 'Block user from interacting with the bot or replying.')
            : (userLabel ? `${userLabel} をブロックします。今後アカウントへのリプライや接触が遮断されます。` : '対象ユーザーをブロックします。今後アカウントへのリプライや接触が遮断されます。');
        } else {
          impactLevel = 'warning';
          title = isEn
            ? (userLabel ? `Unblock User ${userLabel}` : 'Unblock User')
            : (userLabel ? `ユーザー ${userLabel} のブロック解除` : 'ユーザーのブロック解除');
          description = isEn
            ? (userLabel ? `Restore interaction permissions for ${userLabel}.` : 'Restore interaction permissions for user.')
            : (userLabel ? `${userLabel} のブロックを解除し、正常な対話権限を復帰させます。` : '対象ユーザーのブロックを解除し、正常な対話権限を復帰させます。');
        }

        payload.userId = resolvedId;
        payload.handle = resolvedHandle;
        payload.name = resolvedName;
        break;
      }

      case 'DELETE_POST': {
        const cleanPostId = cleanTarget.replace(/^#/, '');
        if (!cleanPostId) {
          return {
            data: {
              error: isEn
                ? 'targetId (postId) is required to delete a post.'
                : '投稿の削除には対象の投稿ID（targetId）が必要です。'
            }
          };
        }
        if (context.timelineRepo && typeof context.timelineRepo.getPostById === 'function') {
          const post = await context.timelineRepo.getPostById(cleanPostId);
          if (!post) {
            return {
              data: {
                error: isEn
                  ? `Post "${cleanPostId}" was not found in the database. Please check the post ID using search_timeline_posts first.`
                  : `投稿「${cleanPostId}」はデータベースに見つかりませんでした。事前にsearch_timeline_postsで投稿IDを確認してください。`
              }
            };
          }
        }
        impactLevel = 'danger';
        title = isEn ? 'Confirm Post Deletion' : '投稿の削除確認';
        description = isEn
          ? 'Permanently delete this post from system logs and X (Twitter).'
          : '対象の投稿をシステムおよびX（Twitter）から完全に削除します。';
        payload.postId = cleanPostId;
        break;
      }

      case 'FORCE_DREAMING':
        impactLevel = 'warning';
        title = isEn ? 'Trigger Memory Consolidation (Dreaming)' : '長期記憶の統合（ドリーミング）実行';
        description = isEn ? 'Process recent conversation logs to update long-term RAG memory and evolve persona.' : '未集約の対話ログとユーザー属性を要約・抽出し、長期記憶（RAG）を最新状態にアップデートします。';
        break;

      case 'REGENERATE_CAPTIONS':
        impactLevel = 'warning';
        title = isEn ? 'Trigger Caption Regeneration' : 'キャプション再生成ジョブ実行';
        description = isEn ? 'Start a background task to regenerate Vision captions and embeddings for failed assets.' : 'キャプション生成に失敗している画像アセットの再解析ジョブをバックグラウンドで起動します。';
        break;
    }

    const actionRequired: CopilotAction = {
      type: actionType,
      title,
      description,
      impactLevel,
      requiresConfirmation: true,
      payload
    };

    return {
      data: {
        status: 'CONFIRMATION_REQUIRED',
        actionType,
        targetId: cleanTarget,
        message: isEn ? 'Human approval card requested' : '承認カードを提示しました'
      },
      actionRequired
    };
  }
}
