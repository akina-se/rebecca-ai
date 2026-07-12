import 'dotenv/config';

/**
 * Application configuration settings.
 */
export default { 
  /**
   * The port on which the application runs.
   */
  port: process.env.PORT || 8080,

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
  },

  /**
   * Configuration for the X (formerly Twitter) API.
   */
  xApi: {
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
    bearerToken: process.env.X_BEARER_TOKEN,
    myUserId: process.env.X_MY_USER_ID,
    targetListId: process.env.X_TARGET_LIST_ID,
    followersMaxResults: parseInt(process.env.X_FOLLOWERS_MAX_RESULTS || '1000', 10),
  },

  /**
   * Configuration for the Gemini AI models.
   */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    judgeModel: process.env.GEMINI_JUDGE_MODEL || 'gemma-4-31b-it',
    languageModel: process.env.GEMINI_LANGUAGE_MODEL || 'gemma-4-31b-it',
    visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite',
    imageInferenceModel: process.env.GEMINI_IMAGE_INFERENCE_MODEL || 'gemini-3.1-flash-lite',
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
    cooldownDays: parseInt(process.env.IMAGE_COOLDOWN_DAYS || '3', 10),
    bucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
  },

  /**
   * Global rate limiting configurations.
   */
  limits: {
    globalDailyLimit: parseInt(process.env.GLOBAL_DAILY_LIMIT || '500', 10),
    spamMinuteLimit: parseInt(process.env.SPAM_MINUTE_LIMIT || '3', 10),
    publicIpRateLimit: parseInt(process.env.PUBLIC_IP_RATE_LIMIT || '100', 10),
  },

  /**
   * Configuration for memory evolution.
   */
  evolution: {
    lookbackDays: parseInt(process.env.EVOLUTION_LOOKBACK_DAYS || '7', 10),
  },
};
