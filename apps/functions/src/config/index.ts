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
}

export interface FunctionsConfig {
  xApi: XApiConfig;
}

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
  },
});

export const config = getConfig();
