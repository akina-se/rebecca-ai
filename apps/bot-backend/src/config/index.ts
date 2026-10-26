import 'dotenv/config';
import { ThinkingLevel } from '@google/genai';
import { logger } from '../utils/logger';

/**
 * Validates and normalizes Gemini ThinkingLevel enum.
 * Defaults to ThinkingLevel.MEDIUM if unspecified or unrecognized.
 *
 * @param level - Thinking level string from environment.
 * @returns Strongly-typed ThinkingLevel enum.
 */
export const getValidatedThinkingLevel = (level?: string): ThinkingLevel => {
  const upper = (level || '').trim().toUpperCase();
  if (upper === 'MINIMAL') return ThinkingLevel.MINIMAL;
  if (upper === 'LOW') return ThinkingLevel.LOW;
  if (upper === 'HIGH') return ThinkingLevel.HIGH;
  return ThinkingLevel.MEDIUM;
};

/**
 * Validates whether the provided string is a valid IANA time zone identifier (RFC 6557 / ECMA-402).
 * Falls back to 'Asia/Tokyo' if undefined, empty, or invalid.
 *
 * @param tz - Timezone string to validate.
 * @returns A validated IANA timezone string.
 */
export const getValidatedTimezone = (tz?: string): string => {
  if (!tz || tz.trim() === '') {
    return 'Asia/Tokyo';
  }
  const trimmed = tz.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    logger.warn('[Config] Invalid IANA timezone specified, falling back to default', { timezone: trimmed, defaultTimezone: 'Asia/Tokyo' });
    return 'Asia/Tokyo';
  }
};

/**
 * Application configuration settings.
 */
export default { 
  /**
   * The port on which the application runs.
   */
  port: process.env.PORT || 8080,

  /**
   * Standard IANA application time zone (e.g., 'Asia/Tokyo', 'America/New_York').
   */
  appTimezone: getValidatedTimezone(process.env.APP_TIMEZONE),

  /**
   * Secret key for batch endpoints when not using OIDC.
   */
  batchSecret: process.env.BATCH_SECRET_KEY,

  /**
   * Google Cloud Platform configuration.
   */
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'asia-northeast1',
    queueName: process.env.GCP_TASK_QUEUE_NAME || 'rebecca-reply-queue',
    workerUrl: process.env.WORKER_URL,
    serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
  },

  /**
   * Configuration for the X (formerly Twitter) API.
   */
  xApi: {
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
    myUserId: process.env.X_MY_USER_ID,
    targetListId: process.env.X_TARGET_LIST_ID,
    followersPageSize: Math.max(5, Math.min(100, parseInt(process.env.X_FOLLOWERS_PAGE_SIZE || '10', 10) || 10)),
    followersMaxResults: Math.max(5, Math.min(1000, parseInt(process.env.X_FOLLOWERS_MAX_RESULTS || '30', 10) || 30)),
  },

  /**
   * Configuration for the Gemini AI models.
   */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    judgeModel: process.env.GEMINI_JUDGE_MODEL || process.env.JUDGE_MODEL || 'gemini-3.1-flash-lite',
    languageModel: process.env.GEMINI_LANGUAGE_MODEL || 'gemini-3.1-flash-lite',
    visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-3.5-flash-lite',
    imageInferenceModel: process.env.GEMINI_IMAGE_INFERENCE_MODEL || 'gemini-3.5-flash-lite',
    newsSearchModel: process.env.GEMINI_NEWS_SEARCH_MODEL || 'gemini-2.5-flash',
    newsPostModel: process.env.GEMINI_NEWS_POST_MODEL || 'gemini-3.5-flash-lite',
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '1.20'),
    topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
    thinkingLevel: getValidatedThinkingLevel(process.env.GEMINI_THINKING_LEVEL),
  },

  /**
   * Configuration for RAG (Retrieval-Augmented Generation) memory.
   */
  rag: {
    maxMemories: parseInt(process.env.RAG_MAX_MEMORIES as string) || 100,
  },

  /**
   * Configuration for image handling and storage.
   */
  images: {
    cooldownDays: parseInt(process.env.IMAGE_COOLDOWN_DAYS || '14', 10),
    similarityThreshold: parseFloat(process.env.IMAGE_SIMILARITY_THRESHOLD || '0.35'),
    bucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
    allowedDomains: (process.env.ALLOWED_IMAGE_DOMAINS || 'twimg.com,twitter.com,x.com,example.com')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  },

  /**
   * Global rate limiting configurations.
   */
  limits: {
    globalDailyLimit: parseInt(process.env.GLOBAL_DAILY_LIMIT || '500', 10),
    userDailyLimit: parseInt(process.env.USER_DAILY_LIMIT || '5', 10),
    spamMinuteLimit: parseInt(process.env.SPAM_MINUTE_LIMIT || '3', 10),
    publicIpRateLimit: parseInt(process.env.PUBLIC_IP_RATE_LIMIT || '100', 10),
  },

  /**
   * Configuration for memory evolution.
   */
  evolution: {
    lookbackDays: parseInt(process.env.EVOLUTION_LOOKBACK_DAYS || '7', 10),
  },

  /**
   * Configuration for proactive news deduplication and posting.
   */
  news: {
    dedupLookbackDays: Math.max(1, parseInt(process.env.NEWS_DEDUP_LOOKBACK_DAYS || '30', 10) || 30),
    dedupSimilarityThreshold: Math.max(0.1, Math.min(1.0, parseFloat(process.env.NEWS_DEDUP_SIMILARITY_THRESHOLD || '0.82') || 0.82)),
  },

  /**
   * Configuration for interactive X poll posts.
   * X API v2 requires poll duration_minutes between 5 (5 minutes) and 10080 (7 days).
   */
  poll: {
    durationMinutes: Math.max(5, Math.min(10080, parseInt(process.env.POLL_DURATION_MINUTES || '1380', 10) || 1380)),
  },

  /**
   * Active persona configuration.
   */
  persona: {
    activeId: (process.env.ACTIVE_PERSONA || 'rebecca').trim() || 'rebecca',
  },

  /**
   * Configuration for supporter appreciation and tipping system.
   */
  support: {
    officialPortalUrl: process.env.SUPPORT_OFFICIAL_PORTAL_URL || 'https://rebecca-ai.net/supporters#plans',
    fallbackName: process.env.SUPPORT_FALLBACK_NAME || '名無しのマスター',
    maxNameLength: Math.max(5, Math.min(50, parseInt(process.env.SUPPORT_MAX_NAME_LENGTH || '20', 10) || 20)),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    paymentLinks: {
      bronze: process.env.STRIPE_PAYMENT_LINK_BRONZE || '',
      silver: process.env.STRIPE_PAYMENT_LINK_SILVER || '',
      gold: process.env.STRIPE_PAYMENT_LINK_GOLD || '',
    },
    contactEmail: (process.env.SUPPORT_CONTACT_EMAIL || '').trim(),
  },
};

