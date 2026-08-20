import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start --workspace=dashboard-backend',
      url: 'http://127.0.0.1:8081/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
      env: {
        PORT: '8081',
        GCP_PROJECT_ID: 'rebecca-ai-gal-local',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      },
    },
    {
      command: 'node ../../scripts/serve-frontend.js',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});
