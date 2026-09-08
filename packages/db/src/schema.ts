/**
 * @rebecca/db/schema – Firestore collection identifiers and schema constants.
 *
 * DESIGN NOTE:
 * This file is purely declarative and contains ZERO imports from `@google-cloud/firestore`
 * or gRPC. It can be safely imported anywhere (including unit tests, middleware, or CLI tools)
 * without triggering gRPC initialization or runtime side effects.
 */

/** All Firestore collection identifiers used across the Rebecca AI system. */
export const COLLECTIONS = {
  /** Primary user documents: profiles, episodic buffers, working memory. */
  USERS: 'users',

  /** TTL-based raw conversation logs (5-year expiry). */
  CONVERSATION_LOGS: 'conversation_logs',

  /** TTL-based timeline post history (5-year expiry). */
  TIMELINE_HISTORY: 'timeline_history',

  /** Vector-indexed RAG memory entries per user. */
  RAG_MEMORIES: 'rag_memories',

  /**
   * Rate-limit counters (global daily, user daily, user per-minute).
   * Doc IDs follow the pattern: `global_<date>`, `user_<id>_<date>`, etc.
   */
  RATE_LIMITS: 'rate_limits',

  /**
   * System singleton documents.
   * Known doc IDs: `persona`, `x_api_state`.
   */
  SYSTEM: 'system',

  /**
   * System-wide statistics (e.g., daily active users).
   * Known doc IDs: `dau_<YYYY-MM-DD>`.
   */
  SYSTEM_STATS: 'system_stats',

  /**
   * Idempotency log: records mention tweet IDs that have been processed.
   * Doc ID = tweet ID.
   */
  PROCESSED_MENTIONS: 'processed_mentions',

  /**
   * Vector-indexed image asset metadata.
   * Doc ID = image hash (SHA-256 or similar).
   */
  IMAGES: 'images',

  /**
   * Tracks followers that have been through the onboarding pipeline.
   * Doc ID = follower's X user ID.
   */
  PROCESSED_FOLLOWERS: 'processed_followers',

  /**
   * Tracks the last list-interaction timestamp per user.
   * Doc ID = X user ID.
   */
  LIST_INTERACTION_HISTORY: 'list_interaction_history',

  /**
   * Authorized dashboard administrators for RBAC.
   * Doc ID = Firebase Auth UID.
   */
  ADMIN_USERS: 'admin_users',

  /**
   * Idempotency log: records Eventarc event IDs processed by Cloud Functions.
   * Doc ID = Eventarc eventId.
   */
  PROCESSED_EVENTS: 'processed_events',
} as const;

// Derive a union type for all collection name values.
export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ---------------------------------------------------------------------------
// Database Model Types (Physical Firestore Document Schemas)
// ---------------------------------------------------------------------------

import type {
  UserStatus,
  PostStatus,
  AssetStatus,
  AdminRole,
  AdminUserStatus,
  FollowerListStatus,
  ConversationLogEntry,
  UserCoreProfile,
} from '@rebecca/types';

/** Represents an administrator account authorized to access the dashboard. */
export interface AdminUser {
  email: string;
  role: AdminRole;
  status: AdminUserStatus;
  createdAt: string;
}

/** Idempotency record for Eventarc cloud events processed by Cloud Functions. */
export interface ProcessedEvent {
  processedAt: string;
  type: string;
  logId?: string;
}

/**
 * Represents a user document as stored in Firestore.
 * The `id` field mirrors the Firestore document ID and is populated on read.
 */
export interface FirestoreUser {
  id?: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  coreProfile: UserCoreProfile;
  working_memory?: ConversationLogEntry[];
  episodicBuffer: ConversationLogEntry[];
  /** ISO 8601 date string (YYYY-MM-DD) */
  lastReplyDate?: string;
  dailyReplyCount?: number;
  status?: UserStatus;
  firstSeen?: string;
  lastSeen?: string;
}

/** Represents a memory entry used in Retrieval-Augmented Generation (RAG). */
export interface RagMemory {
  userId: string;
  text: string;
  embedding: number[];
  /** ISO 8601 datetime string */
  timestamp: string;
}

/**
 * Represents a raw conversation log between a user and the AI.
 * `expireAt` is serialized as an ISO string to remain Firestore-agnostic.
 */
export interface RawConversationLog {
  userId: string;
  userText: string;
  aiText: string;
  /** Inner thought of the persona during response generation */
  thought?: string;
  /** ISO 8601 datetime string */
  timestamp: string;
  /** ISO 8601 datetime string (TTL expiry) */
  expireAt: string;
}

/**
 * Represents a post on the AI's timeline.
 * `expireAt` is serialized as an ISO string to remain Firestore-agnostic.
 */
export interface TimelinePost {
  text: string;
  /** Inner thought of the persona during post generation */
  thought?: string;
  /** ISO 8601 datetime string */
  timestamp: string;
  /** ISO 8601 datetime string (TTL expiry) */
  expireAt: string;
  status?: PostStatus;
  impressions?: number;
  likes?: number;
  retweets?: number;
  reposts?: number;
  replies?: number;
  mediaUrls?: string[];
  media_urls?: string[];
  tweetId?: string;
  tweet_id?: string;
  assetId?: string;
  authorId?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatarUrl?: string;
  postType?: 'news' | 'soliloquy' | 'random_engagement' | 'anniversary';
  newsTitle?: string;
  newsEmbedding?: number[];
  anniversaryTitle?: string;
}

/** Rate-limit tracking document for a user within a time window. */
export interface RateLimitDoc {
  count: number;
}

/** Represents the AI persona configuration stored in Firestore. */
export interface PersonaDoc {
  extended_prompt?: string;
  /** ISO 8601 datetime string */
  updatedAt?: string;
  timeline_summary?: string;
  /** ISO 8601 datetime string */
  timelineSummaryUpdatedAt?: string;
}

/** Represents the persisted state of the X API integration. */
export interface XApiStateDoc {
  last_mention_id?: string | null;
  /** ISO 8601 datetime string */
  updatedAt?: string;
}

/**
 * Represents an image document with its AI-generated caption and vector embedding.
 * `lastUsedAt` is serialized as an ISO string or null to remain Firestore-agnostic.
 */
export interface ImageDoc {
  url: string;
  filename?: string;
  caption: string;
  embedding: number[];
  /** ISO 8601 datetime string, or null if never used */
  lastUsedAt: string | null;
  useCount: number;
  status?: AssetStatus;
  createdAt?: string;
}

/** Extends `ImageDoc` with the Firestore document ID. */
export interface ImageDocWithId extends ImageDoc {
  id: string;
}

/** Tracks a follower that has been processed by the onboarding pipeline. */
export interface ProcessedFollower {
  userId: string;
  /** ISO 8601 datetime string */
  timestamp: string;
  /** Membership status in the curated list */
  listStatus: FollowerListStatus;
}

/**
 * Tracks the last interaction with a list member.
 * `lastInteractionAt` is serialized as an ISO string to remain Firestore-agnostic.
 */
export interface ListInteraction {
  userId: string;
  /** ISO 8601 datetime string */
  lastInteractionAt: string;
}
