/**
 * apps/bot-backend/src/types/index.ts
 *
 * Re-exports all shared data models from @rebecca/types and adds
 * backend-only types that depend on Firestore's Timestamp class.
 *
 * IMPORTANT: Keep Firestore-specific augmentation here (not in @rebecca/types),
 * so the shared package stays framework-agnostic and usable by the frontend.
 */

// Re-export all shared data models for backward compatibility.
// Existing backend code that imports from './types' continues to work unchanged.
export * from '@rebecca/types';

// Re-export all service interfaces (backend-only contracts).
export * from './interfaces';

import {
  IFirestoreService,
  IGeminiService,
  IXApiService,
  ITasksService,
  IStorageService,
} from './interfaces';
import { IPersonaDefinition } from '@rebecca/persona';

/** Aggregates all service dependencies injected at the application root. */
export interface AppDependencies {
  firestore: IFirestoreService;
  gemini: IGeminiService;
  xApi: IXApiService;
  tasks: ITasksService;
  storage: IStorageService;
  persona: IPersonaDefinition;
}

/**
 * Canonical base result contract for proactive timeline batch use cases (News, Soliloquy, Anniversary).
 */
export interface ProactiveBatchResult {
  /** The execution status of the batch job. */
  status: 'success' | 'skipped' | 'failed';
  /** A descriptive reason if the status is skipped or failed. */
  reason?: string;
  /** The content of the tweet that was posted, if successful. */
  post?: string;
  /** Indicates whether media (e.g., an image) was attached to the post. */
  attachedMedia?: boolean;
}
