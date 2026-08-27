import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getConfig, X_SECRET_KEYS } from '../config';
import { XApiService } from '../services/xApi';
import { SyncTimelineUseCase } from '../usecases/syncTimelineUseCase';

/**
 * Scheduled Cloud Function trigger that executes once daily at 04:00 JST (19:00 UTC).
 * Thin trigger entrypoint orchestrating DI and executing SyncTimelineUseCase.
 */
export const scheduledTimelineSync = onSchedule(
  {
    schedule: 'every day 04:00',
    timeZone: 'Asia/Tokyo',
    retryCount: 1,
    memory: '256MiB',
    timeoutSeconds: 120,
    secrets: [...X_SECRET_KEYS],
  },
  async () => {
    const currentConfig = getConfig();
    const xApiService = new XApiService(currentConfig.xApi);
    const useCase = new SyncTimelineUseCase(xApiService);

    await useCase.execute(currentConfig.xApi.myUserId);
  }
);
