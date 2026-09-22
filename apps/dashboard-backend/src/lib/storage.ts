import { Storage as GcsStorage } from '@google-cloud/storage';
import { config } from '../config';

/**
 * Factory for Google Cloud Storage client.
 * Explicitly resolves emulator endpoint from environment without mutating global process.env.
 */
let cachedGcsStorage: GcsStorage | null = null;
export const getGcsStorageClient = (): GcsStorage => {
  if (!cachedGcsStorage) {
    const emulatorHost = process.env.STORAGE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const apiEndpoint = emulatorHost
      ? (emulatorHost.startsWith('http') ? emulatorHost : `http://${emulatorHost}`)
      : undefined;

    cachedGcsStorage = new GcsStorage({
      projectId: config.gcp.projectId,
      ...(apiEndpoint ? { apiEndpoint } : {}),
    });
  }
  return cachedGcsStorage;
};
