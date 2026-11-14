import { Client, OAuth1 } from '@xdevplatform/xdk';
import * as logger from 'firebase-functions/logger';
import { XApiConfig } from '../config';

export interface PollOptionDto {
  position: number;
  label: string;
  votes: number;
}

export interface PollDataDto {
  id?: string;
  options: PollOptionDto[];
  durationMinutes?: number;
  endDatetime?: string;
  votingStatus?: 'open' | 'closed';
}

export interface TimelineTweetDto {
  id: string;
  text: string;
  createdAt?: string;
  impressions: number;
  likes: number;
  reposts: number;
  replies: number;
  mediaUrls: string[];
  poll?: PollDataDto;
}

export interface IXApiService {
  fetchRecentTimelineTweets(userId?: string, limit?: number): Promise<TimelineTweetDto[]>;
  getMyUserId(): Promise<string | null>;
  cachedMyUserId: string | null;
}

/**
 * Structured error representing an X API failure normalized at the SDK boundary.
 */
export class XApiError extends Error {
  /** HTTP status code returned by the X API (400-599), if available. */
  readonly statusCode?: number;

  /**
   * Initializes an XApiError instance.
   * @param message Human-readable error message.
   * @param statusCode Optional HTTP status code in the 400-599 range.
   * @param cause Optional underlying cause.
   */
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'XApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes an unknown error thrown by `@xdevplatform/xdk` into an {@link XApiError},
 * preserving HTTP 4xx/5xx status codes and upstream detail fields (`data.detail` / `data.error`).
 *
 * @param error Unknown caught error from the X SDK.
 */
export function toXApiError(error: unknown): XApiError {
  if (error instanceof XApiError) {
    return error;
  }
  if (!error || typeof error !== 'object') {
    return new XApiError(String(error), undefined, error);
  }
  const { status, statusCode, message, data } = error as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
    data?: { detail?: unknown; error?: unknown };
  };
  const code = typeof statusCode === 'number' ? statusCode : status;
  const validStatus =
    typeof code === 'number' && Number.isInteger(code) && code >= 400 && code <= 599
      ? code
      : undefined;

  const detail =
    typeof data?.detail === 'string' && data.detail.trim()
      ? data.detail.trim()
      : typeof data?.error === 'string' && data.error.trim()
        ? data.error.trim()
        : undefined;
  const resolvedMessage =
    detail ??
    (typeof message === 'string' && message.trim()
      ? message.trim()
      : validStatus !== undefined
        ? `HTTP ${validStatus}`
        : 'X API request failed');

  return new XApiError(resolvedMessage, validStatus, error);
}

function logAndRethrowXApiError(error: unknown, warnContext: string, errContext: string): never {
  const xError = toXApiError(error);
  if (xError.statusCode !== undefined && xError.statusCode < 500) {
    logger.warn(warnContext, { statusCode: xError.statusCode, message: xError.message });
  } else {
    logger.error(errContext, { error: xError });
  }
  throw xError;
}

interface XdkTweetResponse {
  data?: Array<{
    id: string;
    text: string;
    createdAt?: string;
    attachments?: {
      mediaKeys?: string[];
      pollIds?: string[];
    };
    publicMetrics?: {
      impressionCount?: number;
      likeCount?: number;
      repostCount?: number;
      quoteCount?: number;
      bookmarkCount?: number;
      replyCount?: number;
    };
  }>;
  includes?: {
    media?: Array<{
      mediaKey: string;
      url?: string;
      previewImageUrl?: string;
      type?: string;
    }>;
    polls?: Array<{
      id: string;
      options: Array<{
        position: number;
        label: string;
        votes: number;
      }>;
      durationMinutes?: number;
      endDatetime?: string;
      votingStatus?: 'open' | 'closed';
    }>;
  };
}

/**
 * Infrastructure service responsible for interacting with the X (Twitter) API v2.
 * Encapsulates the external SDK and maps responses to clean DTOs.
 */
export class XApiService implements IXApiService {
  private client: Client | null = null;
  public cachedMyUserId: string | null = null;

  constructor(private xApiConfig: XApiConfig) {
    this.client = this.createClient(xApiConfig);
    if (xApiConfig.myUserId) {
      this.cachedMyUserId = xApiConfig.myUserId;
    }
  }

  private createClient(cfg: XApiConfig): Client | null {
    const { apiKey, apiSecret, accessToken, accessSecret, bearerToken } = cfg;

    if (apiKey && apiSecret && accessToken && accessSecret) {
      const oauth1 = new OAuth1({
        apiKey,
        apiSecret,
        callback: 'oob',
        accessToken,
        accessTokenSecret: accessSecret,
      });
      return new Client({ oauth1 });
    }

    if (bearerToken) {
      return new Client({ bearerToken });
    }

    return null;
  }

  /**
   * Resolves the authenticated user ID via `getMe()` and caches it.
   * Returns `null` only when the X client is unconfigured or the API payload omits an ID.
   *
   * @throws When the upstream X API request fails (normalized to {@link XApiError}).
   */
  async getMyUserId(): Promise<string | null> {
    if (this.cachedMyUserId) {
      return this.cachedMyUserId;
    }
    if (!this.client?.users?.getMe) {
      return null;
    }
    try {
      const meResponse = await this.client.users.getMe();
      const resolvedId = meResponse?.data?.id;
      if (resolvedId) {
        this.cachedMyUserId = resolvedId;
        return resolvedId;
      }
      return null;
    } catch (error: unknown) {
      logAndRethrowXApiError(
        error,
        '[XApiService] Upstream rejected getMe request',
        '[XApiService] Failed to auto-resolve authenticated user ID via getMe'
      );
    }
  }

  /**
   * Fetches recent timeline posts authored by the specified user, excluding reposts and replies.
   *
   * @param userId - Optional. The X user ID whose tweets are to be fetched. If omitted, auto-resolves via getMyUserId().
   * @param limit - Maximum number of tweets to fetch (defaults to configured syncMaxResults, max 100).
   * @returns Array of normalized TimelineTweetDto items.
   * @throws When the upstream X API request fails (normalized to {@link XApiError}).
   */
  async fetchRecentTimelineTweets(userId?: string, limit?: number): Promise<TimelineTweetDto[]> {
    if (!this.client) {
      logger.warn('[XApiService] X API client is not configured');
      return [];
    }

    const normalizedUserId = userId && userId.trim() ? userId.trim() : null;
    const targetUserId = normalizedUserId ?? this.cachedMyUserId ?? (await this.getMyUserId());
    if (!targetUserId) {
      logger.warn('[XApiService] Target userId is not specified and could not be resolved');
      return [];
    }

    const effectiveLimit = limit ?? this.xApiConfig.syncMaxResults ?? 30;

    let response: XdkTweetResponse;
    try {
      response = (await this.client.users.getPosts(targetUserId, {
        maxResults: effectiveLimit,
        exclude: ['retweets', 'replies'],
        postFields: ['created_at', 'public_metrics', 'attachments', 'text'],
        expansions: ['attachments.media_keys', 'attachments.poll_ids'],
        mediaFields: ['url', 'preview_image_url', 'type'],
        pollFields: ['duration_minutes', 'end_datetime', 'id', 'options', 'voting_status'],
      } as Parameters<typeof this.client.users.getPosts>[1])) as XdkTweetResponse;
    } catch (error: unknown) {
      logAndRethrowXApiError(
        error,
        '[XApiService] Upstream rejected getPosts request',
        '[XApiService] Failed to fetch recent timeline tweets'
      );
    }

    const tweets = response?.data ?? [];
    if (tweets.length === 0) {
      return [];
    }

    // Build media map for fast lookups
    const mediaMap = new Map<string, string>();
    if (response.includes?.media) {
      for (const media of response.includes.media) {
        const mediaUrl = media.url ?? media.previewImageUrl;
        if (media.mediaKey && mediaUrl) {
          mediaMap.set(media.mediaKey, mediaUrl);
        }
      }
    }

    // Build poll map for fast lookups
    const pollMap = new Map<string, PollDataDto>();
    if (response.includes?.polls) {
      for (const poll of response.includes.polls) {
        if (poll.id && Array.isArray(poll.options)) {
          pollMap.set(poll.id, {
            id: poll.id,
            options: poll.options.map((opt) => ({
              position: Number.isFinite(Number(opt.position)) ? Number(opt.position) : 0,
              label: opt.label ?? '',
              votes: Number.isFinite(Number(opt.votes)) ? Number(opt.votes) : 0,
            })),
            ...(typeof poll.durationMinutes === 'number' ? { durationMinutes: poll.durationMinutes } : {}),
            ...(poll.endDatetime ? { endDatetime: poll.endDatetime } : {}),
            ...(poll.votingStatus ? { votingStatus: poll.votingStatus } : {}),
          });
        }
      }
    }

    return tweets.map((tweet) => {
      const pm = tweet.publicMetrics;
      const mediaKeys = tweet.attachments?.mediaKeys;
      const pollId = tweet.attachments?.pollIds?.[0];

      const mediaUrls: string[] = [];
      if (Array.isArray(mediaKeys)) {
        for (const key of mediaKeys) {
          const url = mediaMap.get(key);
          if (url) mediaUrls.push(url);
        }
      }

      const poll = pollId ? pollMap.get(pollId) : undefined;

      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.createdAt,
        impressions: pm?.impressionCount ?? 0,
        likes: pm?.likeCount ?? 0,
        reposts: pm?.repostCount ?? 0,
        replies: pm?.replyCount ?? 0,
        mediaUrls,
        ...(poll ? { poll } : {}),
      };
    });
  }
}
