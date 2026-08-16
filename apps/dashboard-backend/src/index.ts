import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Firestore } from '@google-cloud/firestore';

/**
 * Application entry point for the Dashboard Backend (BFF).
 * Initializes and wires up all Express routes, middleware, and core services like Firestore.
 */
// Modules
import { initializeAuthModule } from './features/auth';
import { initializeCopilotModule } from './features/copilot';
import { initializeTimelineModule } from './features/timeline';
import { initializeUsersModule } from './features/users';
import { initializeSystemMemoryModule } from './features/system-memory';
import { initializeAssetsModule } from './features/assets';
import { initializeSettingsModule } from './features/settings';

import { config } from './config';

const app = express();
const port = config.server.port;

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

// Initialize Shared Infrastructure (Core)
const firestore = new Firestore({
  projectId: config.gcp.projectId,
});

// Initialize Features (Modules)
const authRouter = initializeAuthModule();
const copilotRouter = initializeCopilotModule(firestore);
const { dashboardRouter: timelineRouter, postsRouter } = initializeTimelineModule(firestore);
const usersRouter = initializeUsersModule(firestore);
const systemMemoryRouter = initializeSystemMemoryModule(firestore);
const assetsRouter = initializeAssetsModule(firestore);
const settingsRouter = initializeSettingsModule(firestore);

// Mount Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/copilot', copilotRouter);
// Note: Timeline handles /metrics and /posts
app.use('/api/v1', timelineRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/memory', systemMemoryRouter);
app.use('/api/v1/images', assetsRouter);
app.use('/api/v1/settings', settingsRouter);

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'dashboard-bff' });
});

// Start Server
app.listen(port, () => {
  console.log(`Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI.`);
});
