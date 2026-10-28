export const FUNCTION_SECRET_KEYS = [
  'X_API_KEY',
  'X_API_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_SECRET',
  'X_BEARER_TOKEN',
] as const;

export const X_SECRET_KEYS = FUNCTION_SECRET_KEYS;

export interface XApiConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  myUserId: string;
  syncMaxResults?: number;
}

export interface FunctionsConfig {
  batchSecretKey?: string;
  functionsUrl?: string;
  serviceAccountEmail?: string;
  xApi: XApiConfig;
}

const parseMaxResults = (envValue: string | undefined): number => {
  if (!envValue) return 30;
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed < 5) return 30;
  return Math.min(parsed, 100);
};

/**
 * Retrieves the strongly-typed application configuration.
 */
export const getConfig = (): FunctionsConfig => {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const region = process.env.GCP_LOCATION || process.env.FUNCTION_REGION || 'asia-northeast1';
  const defaultFunctionsUrl = projectId
    ? `https://${region}-${projectId}.cloudfunctions.net/batchTimelineSync`
    : undefined;

  return {
    batchSecretKey: process.env.BATCH_SECRET_KEY,
    functionsUrl: process.env.FUNCTIONS_URL || defaultFunctionsUrl,
    serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
    xApi: {
      apiKey: process.env.X_API_KEY || '',
      apiSecret: process.env.X_API_SECRET || '',
      accessToken: process.env.X_ACCESS_TOKEN || '',
      accessSecret: process.env.X_ACCESS_SECRET || '',
      bearerToken: process.env.X_BEARER_TOKEN || '',
      myUserId: process.env.X_MY_USER_ID || '',
      syncMaxResults: parseMaxResults(process.env.X_SYNC_MAX_RESULTS),
    },
  };
};

export const config = getConfig();
