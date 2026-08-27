let schedulerTriggerHandler: any;

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn().mockImplementation((_opts, handler) => {
    schedulerTriggerHandler = handler;
    return { run: handler };
  }),
}));

const mockExecute = jest.fn().mockResolvedValue({ processed: 2, updated: 1, created: 1, errors: 0 });
jest.mock('../../src/usecases/syncTimelineUseCase', () => ({
  SyncTimelineUseCase: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

jest.mock('../../src/services/xApi', () => ({
  XApiService: jest.fn().mockImplementation(() => ({})),
}));

import { scheduledTimelineSync } from '../../src/triggers/scheduledTimelineSync';

describe('scheduledTimelineSync Trigger (Thin Controller)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should be defined and registered with onSchedule', () => {
    expect(scheduledTimelineSync).toBeDefined();
    expect(schedulerTriggerHandler).toBeDefined();
  });

  it('should instantiate dependencies and delegate execution to SyncTimelineUseCase', async () => {
    process.env.X_MY_USER_ID = '987654321';

    await schedulerTriggerHandler({});
    expect(mockExecute).toHaveBeenCalledWith('987654321');
  });
});
