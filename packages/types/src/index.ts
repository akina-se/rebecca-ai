/**
 * @rebecca/types
 *
 * Shared data model type definitions for the Rebecca AI monorepo.
 * These types are framework-agnostic and safe to use in both the
 * bot-backend (Node.js) and dashboard-frontend (Angular) applications.
 *
 * DESIGN NOTE: Firestore-specific types (e.g., Timestamp) are intentionally
 * excluded here. Backend code that needs Timestamp should cast to/from
 * the serializable string/number representations defined below.
 */

// ---------------------------------------------------------------------------
// Core User Models
// ---------------------------------------------------------------------------

/** Represents the evolving core profile of a user, derived via Dreaming. */
export interface UserCoreProfile {
  [key: string]: unknown;
}

/** Represents a single turn in a conversation log. */
export interface ConversationLogEntry {
  role: 'user' | 'model';
  content: string;
  /** ISO 8601 datetime string */
  timestamp?: string;
}

/**
 * Represents a user document as stored in Firestore.
 * The `id` field mirrors the Firestore document ID and is populated on read.
 */
export interface FirestoreUser {
  id?: string;
  coreProfile: UserCoreProfile;
  working_memory?: ConversationLogEntry[];
  episodicBuffer: ConversationLogEntry[];
  /** ISO 8601 date string (YYYY-MM-DD) */
  last_reply_date?: string;
  daily_reply_count?: number;
}

// ---------------------------------------------------------------------------
// Memory & Storage Models
// ---------------------------------------------------------------------------

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
  /** ISO 8601 datetime string */
  timestamp: string;
  /** ISO 8601 datetime string (TTL expiry) */
  expireAt: string;
}

/** Rate-limit tracking document for a user within a time window. */
export interface RateLimitDoc {
  count: number;
}

// ---------------------------------------------------------------------------
// Configuration / Persona Models
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Image / Asset Models
// ---------------------------------------------------------------------------

/**
 * Represents an image document with its AI-generated caption and vector embedding.
 * `lastUsedAt` is serialized as an ISO string or null to remain Firestore-agnostic.
 */
export interface ImageDoc {
  url: string;
  caption: string;
  embedding: number[];
  /** ISO 8601 datetime string, or null if never used */
  lastUsedAt: string | null;
  useCount: number;
}

/** Extends `ImageDoc` with the Firestore document ID. */
export interface ImageDocWithId extends ImageDoc {
  id: string;
}

// ---------------------------------------------------------------------------
// Social Graph Models
// ---------------------------------------------------------------------------

/** Tracks a follower that has been processed by the onboarding pipeline. */
export interface ProcessedFollower {
  userId: string;
  /** ISO 8601 datetime string */
  timestamp: string;
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

// ---------------------------------------------------------------------------
// X (Twitter) API Models
// ---------------------------------------------------------------------------

/** Represents a media attachment on an X tweet. */
export interface XApiMedia {
  type: string;
  url?: string;
}

/** Represents a tweet object returned from the X API v2. */
export interface XApiTweet {
  id: string;
  text: string;
  authorId?: string;
  /** ISO 8601 datetime string */
  createdAt?: string;
  inReplyToUserId?: string;
  referencedTweets?: Array<{ type: string; id: string }>;
  conversationId?: string;
  attachments?: { mediaKeys?: string[] };
}

/** Represents a user object returned from the X API v2. */
export interface XApiUser {
  id: string;
  name: string;
  username: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// X API Response Envelope Types
// ---------------------------------------------------------------------------

/** Response envelope for mention/timeline tweet list endpoints. */
export interface XApiMentionResponse {
  data?: XApiTweet[];
  includes?: {
    media?: XApiMedia[];
  };
  meta?: {
    resultCount: number;
    oldest_id?: string;
    newest_id?: string;
    next_token?: string;
  };
}

/** Response envelope for single-tweet detail endpoints. */
export interface XApiTweetDetailsResponse {
  data?: XApiTweet;
  includes?: {
    media?: XApiMedia[];
  };
}

/** Response envelope for follower list endpoints. */
export interface XApiFollowersResponse {
  data?: XApiUser[];
  meta?: {
    resultCount: number;
    next_token?: string;
  };
}

/** Response envelope for list member endpoints. */
export interface XApiListMembersResponse {
  data?: XApiUser[];
  meta?: {
    resultCount: number;
    next_token?: string;
  };
}

/** Response envelope for tweet creation endpoints. */
export interface XApiCreateResponse {
  data?: {
    id: string;
    text: string;
  };
}
