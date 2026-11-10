import { FunctionDeclaration } from '@google/genai';
import { CopilotAction, CopilotAttachment } from '@rebecca/types';
import { TimelineRepository } from '../timeline/repository';
import { UsersRepository } from '../users/repository';
import { AssetsRepository } from '../assets/repository';
import { SystemMemoryRepository } from '../system-memory/repository';
import { SupportersRepository } from '../supporters/repository';

/**
 * Execution context supplied to copilot tools containing repository instances and configuration.
 */
export interface CopilotToolContext {
  readonly timelineRepo?: TimelineRepository;
  readonly usersRepo?: UsersRepository;
  readonly assetsRepo?: AssetsRepository;
  readonly memoryRepo?: SystemMemoryRepository;
  readonly supportersRepo?: SupportersRepository;
  readonly geminiApiKey?: string;
  readonly geminiModel?: string;
  readonly isEn: boolean;
}

/**
 * Result returned by a copilot tool execution.
 */
export interface CopilotToolExecutionResult {
  /** Structured output data provided back to the LLM for reasoning. */
  readonly data: unknown;
  /** Optional rich media attachments (images, posts, users) to display on frontend. */
  readonly attachments?: CopilotAttachment[];
  /** Optional proposed human-in-the-loop action if explicitly triggered. */
  readonly actionRequired?: CopilotAction | null;
}

/**
 * Abstract interface for a typed Copilot Tool.
 */
export interface CopilotTool {
  /** Unique snake_case identifier matching Gemini function name. */
  readonly name: string;
  /** Detailed English explanation of tool purpose and when to call it. */
  readonly description: string;
  /** Gemini function declaration schema. */
  readonly declaration: FunctionDeclaration;
  /** Executes the tool logic against domain repositories. */
  execute(params: Record<string, unknown>, context: CopilotToolContext): Promise<CopilotToolExecutionResult>;
}
