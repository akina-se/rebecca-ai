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
    projectId: process.env.GCP_PROJECT_ID || 'rebecca-ai-project',
    location: process.env.GCP_LOCATION || 'asia-northeast1',
    imageBucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
  },
  /** Gemini API Configuration */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  }
} as const;
