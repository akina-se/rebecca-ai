/**
 * Secrets required by Cloud Functions triggers accessing the X (Twitter) API.
 */
export const X_SECRET_KEYS = [
  'X_API_KEY',
  'X_API_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_SECRET',
  'X_BEARER_TOKEN',
  'X_MY_USER_ID',
] as const;

export interface XApiConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
  bearerToken: string;
  myUserId: string;
  syncMaxResults: number;
}

export interface FunctionsConfig {
  xApi: XApiConfig;
}

const parseMaxResults = (envValue: string | undefined): number => {
  if (!envValue) return 100;
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed < 5) return 100;
  return Math.min(parsed, 100);
};

/**
 * Retrieves the strongly-typed application configuration.
 */
export const getConfig = (): FunctionsConfig => ({
  xApi: {
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_SECRET || '',
    bearerToken: process.env.X_BEARER_TOKEN || '',
    myUserId: process.env.X_MY_USER_ID || '',
    syncMaxResults: parseMaxResults(process.env.X_SYNC_MAX_RESULTS),
  },
});

export const config = getConfig();
