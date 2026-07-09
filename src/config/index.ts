import 'dotenv/config';

export default { 
  port: process.env.PORT || 8080,
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'asia-northeast1',
    queueName: process.env.GCP_TASK_QUEUE_NAME || 'rebecca-reply-queue',
    workerUrl: process.env.WORKER_URL, // Webhook base URL for Cloud Tasks to call back
  },
  xApi: {
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
    bearerToken: process.env.X_BEARER_TOKEN,
    myUserId: process.env.X_MY_USER_ID, // Rebecca's own Twitter user ID to filter self-mentions
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    judgeModel: process.env.GEMINI_JUDGE_MODEL || 'gemma-4-31b-it',
    languageModel: process.env.GEMINI_LANGUAGE_MODEL || 'gemma-4-31b-it',
    visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite',
    imageInferenceModel: process.env.GEMINI_IMAGE_INFERENCE_MODEL || 'gemini-3.1-flash-lite',
  },
  rag: {
    maxMemories: parseInt(process.env.RAG_MAX_MEMORIES) || 100,
  },
  images: {
    cooldownDays: parseInt(process.env.IMAGE_COOLDOWN_DAYS || '3', 10),
    bucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
  },
  limits: {
    globalDailyLimit: parseInt(process.env.GLOBAL_DAILY_LIMIT || '45'),
    globalMinuteLimit: parseInt(process.env.GLOBAL_MINUTE_LIMIT || '5'),
    spamMinuteLimit: parseInt(process.env.SPAM_MINUTE_LIMIT || '3'),
  },
  pollingIntervalMinutes: parseInt(process.env.POLLING_INTERVAL_MINUTES || '0', 10),
};
