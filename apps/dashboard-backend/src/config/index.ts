import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });



function parseStorageEmulatorEndpoint(): string | undefined {
  const raw = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.trim()
    || process.env.STORAGE_EMULATOR_HOST?.trim();

  if (!raw) {
    return undefined;
  }

  const withProtocol = raw.includes('://') ? raw : `http://${raw}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withProtocol);
  } catch (e) {
    throw new Error(`Invalid storage emulator endpoint "${raw}": ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }

  if (!parsedUrl.port && parsedUrl.protocol === 'http:') {
    throw new Error(`Storage emulator endpoint "${raw}" must specify an explicit port number (e.g. 127.0.0.1:9199).`);
  }

  return parsedUrl.origin;
}

/**
 * Validates whether the provided string is a valid IANA time zone identifier (RFC 6557 / ECMA-402).
 * Throws on invalid input (fail-fast) or defaults to 'Asia/Tokyo' if unset.
 */
export const getValidatedTimezone = (tz?: string): string => {
  if (tz === undefined || tz.trim() === '') {
    return 'Asia/Tokyo';
  }
  const trimmed = tz.trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch (e) {
    throw new Error(`Invalid IANA timezone "${trimmed}".`, { cause: e });
  }
};

/**
 * Global configuration loader for dashboard-backend
 */
export const config = {
  /** Application timezone */
  appTimezone: getValidatedTimezone(process.env.APP_TIMEZONE),
  /** Server configuration */
  server: {
    port: parseInt(process.env.PORT || '8081', 10),
  },
  /** GCP and Firebase Configuration */
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || 'rebecca-ai-gal-local',
    location: process.env.GCP_LOCATION || 'asia-northeast1',
    imageBucketName: process.env.IMAGE_BUCKET_NAME || 'rebecca-ai-gal-images',
    storageEmulatorEndpoint: parseStorageEmulatorEndpoint(),
  },
  /** Services Configuration */
  services: {
    botBackendUrl: process.env.BOT_BACKEND_URL || '',
  },
  /** Gemini API Configuration */
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '15000', 10),
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
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  /** Persona Configuration */
  persona: {
    activeId: (process.env.ACTIVE_PERSONA || 'rebecca').trim() || 'rebecca',
  },
} as const;

