import { FunctionDeclaration, Type } from '@google/genai';
import { CopilotAction, CopilotActionType } from '@rebecca/types';
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
  readonly description = 'Proposes a safety-gated administrative operation (BLOCK_USER, UNBLOCK_USER, DELETE_POST, FORCE_DREAMING, REGENERATE_CAPTIONS) requiring explicit confirmation from Master. ONLY call this when Master explicitly commanded to execute an operation.';

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
          description: 'Target identifier: user handle/ID for BLOCK/UNBLOCK, postId for DELETE_POST, or empty for system actions.'
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
        impactLevel = 'danger';
        title = isEn ? (cleanTarget ? `Block User ${cleanTarget}` : 'Block User') : (cleanTarget ? `ユーザー ${cleanTarget} のブロック` : 'ユーザーのブロック');
        description = isEn
          ? `Block ${cleanTarget || 'user'} from interacting with Master or replying.`
          : `${cleanTarget || '対象ユーザー'} をブロックします。今後マスターへのリプライや接触が遮断されます。`;
        payload.userId = cleanTarget.replace(/^@/, '');
        payload.handle = cleanTarget.startsWith('@') ? cleanTarget : `@${cleanTarget}`;
        break;

      case 'UNBLOCK_USER':
        impactLevel = 'warning';
        title = isEn ? (cleanTarget ? `Unblock User ${cleanTarget}` : 'Unblock User') : (cleanTarget ? `ユーザー ${cleanTarget} のブロック解除` : 'ユーザーのブロック解除');
        description = isEn ? `Restore interaction permissions for ${cleanTarget}.` : `${cleanTarget} のブロックを解除し、正常な対話権限を復帰させます。`;
        payload.userId = cleanTarget.replace(/^@/, '');
        payload.handle = cleanTarget.startsWith('@') ? cleanTarget : `@${cleanTarget}`;
        break;

      case 'DELETE_POST':
        impactLevel = 'danger';
        title = isEn ? 'Confirm Post Deletion' : '投稿の削除確認';
        description = isEn ? 'Permanently delete this post from system logs and X (Twitter).' : '対象の投稿をシステムおよびX（Twitter）から完全に削除します。';
        payload.postId = cleanTarget.replace(/^#/, '');
        break;

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
