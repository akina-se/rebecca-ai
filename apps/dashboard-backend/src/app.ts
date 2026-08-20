import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Firestore } from '@google-cloud/firestore';

// Middleware
import { verifyAuth } from './middleware/auth';

// Modules
import { initializeAuthModule } from './features/auth';
import { initializeCopilotModule } from './features/copilot';
import { initializeTimelineModule } from './features/timeline';
import { initializeUsersModule } from './features/users';
import { initializeSystemMemoryModule } from './features/system-memory';
import { initializeAssetsModule } from './features/assets';
import { initializeSettingsModule } from './features/settings';
import { initializeConfigModule } from './features/config';

/**
 * Creates and configures the Express application with all middlewares, routes, and security policies.
 * 
 * @param firestore - The Firestore instance to be injected into feature modules.
 * @returns Configured Express application instance.
 */
export function createApp(firestore: Firestore): Express {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Rate Limiting (Protection for BFF: 100 req/min average, burst up to 1500 per 15m)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Initialize Features (Modules)
  const authRouter = initializeAuthModule();
  const copilotRouter = initializeCopilotModule(firestore);
  const { dashboardRouter: timelineRouter, postsRouter } = initializeTimelineModule(firestore);
  const usersRouter = initializeUsersModule(firestore);
  const systemMemoryRouter = initializeSystemMemoryModule(firestore);
  const assetsRouter = initializeAssetsModule(firestore);
  const settingsRouter = initializeSettingsModule(firestore);
  const configRouter = initializeConfigModule();

  // Mount Public Routes
  app.use('/api/v1/config', configRouter);
  app.use('/api/v1/auth', authRouter);

  // Healthcheck endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'dashboard-bff' });
  });

  // Mount Protected Routes with verifyAuth middleware
  app.use('/api/v1/copilot', verifyAuth, copilotRouter);
  app.use('/api/v1', verifyAuth, timelineRouter);
  app.use('/api/v1/posts', verifyAuth, postsRouter);
  app.use('/api/v1/users', verifyAuth, usersRouter);
  app.use('/api/v1/memory', verifyAuth, systemMemoryRouter);
  app.use('/api/v1/images', verifyAuth, assetsRouter);
  app.use('/api/v1/settings', verifyAuth, settingsRouter);

  return app;
}
