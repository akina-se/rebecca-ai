import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Global configuration loader for dashboard-backend
 */
export const config = {
  /** Server configuration */
  server: {
    port: parseInt(process.env.PORT || '8081', 10),
  },
  /** GCP and Firebase Configuration */
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || 'rebecca-ai-gal-local',
    location: process.env.GCP_LOCATION || 'asia-northeast1',
    imageBucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
  },
  /** Services Configuration */
  services: {
    botBackendUrl: process.env.BOT_BACKEND_URL || '',
  },
  /** Gemini API Configuration */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
  },
  /** X API Configuration */
  xApi: {
    appKey: process.env.X_API_KEY || '',
    appSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET || '',
  },
  /** CORS Configuration */
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
} as const;
