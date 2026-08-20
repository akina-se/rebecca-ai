import { initializeAssetsModule } from '../../src/features/assets/index';
import { initializeUsersModule } from '../../src/features/users/index';
import { initializeTimelineModule } from '../../src/features/timeline/index';
import { initializeSystemMemoryModule } from '../../src/features/system-memory/index';
import { initializeCopilotModule } from '../../src/features/copilot/index';
import { initializeAuthModule } from '../../src/features/auth/index';
import { initializeSettingsModule } from '../../src/features/settings/index';
import { createMockFirestore } from './testUtils';

describe('Dashboard Backend Module Initializers Unit Tests', () => {
  let mockFirestore: any;

  beforeEach(() => {
    mockFirestore = createMockFirestore().firestore;
  });

  it('should initialize all feature routers without errors', () => {
    const assetsRouter = initializeAssetsModule(mockFirestore);
    expect(assetsRouter).toBeDefined();

    const usersRouter = initializeUsersModule(mockFirestore);
    expect(usersRouter).toBeDefined();

    const timelineRouter = initializeTimelineModule(mockFirestore);
    expect(timelineRouter).toBeDefined();

    const memoryRouter = initializeSystemMemoryModule(mockFirestore);
    expect(memoryRouter).toBeDefined();

    const copilotRouter = initializeCopilotModule(mockFirestore);
    expect(copilotRouter).toBeDefined();

    const authRouter = initializeAuthModule();
    expect(authRouter).toBeDefined();

    const settingsRouter = initializeSettingsModule(mockFirestore);
    expect(settingsRouter).toBeDefined();
  });
});
