import { Storage as GcsStorage } from '@google-cloud/storage';
import { config } from '../config';

/**
 * Singleton instance cache for Google Cloud Storage client.
 * Configured strictly via config.gcp with validated emulator endpoint.
 */
let cachedGcsStorage: GcsStorage | null = null;

export const getGcsStorageClient = (): GcsStorage => {
  if (!cachedGcsStorage) {
    const apiEndpoint = config.gcp.storageEmulatorEndpoint;

    cachedGcsStorage = new GcsStorage({
      projectId: config.gcp.projectId,
      ...(apiEndpoint ? { apiEndpoint } : {}),
    });
  }
  return cachedGcsStorage;
};

/**
 * Resets cached client for test isolation.
 */
export const resetGcsStorageClientForTesting = (): void => {
  cachedGcsStorage = null;
};
