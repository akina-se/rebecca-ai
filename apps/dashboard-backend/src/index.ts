import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Firestore } from '@google-cloud/firestore';

// Modules
import { initializeAuthModule } from './features/auth';
import { initializeCopilotModule } from './features/copilot';
import { initializeTimelineModule } from './features/timeline';
import { initializeUsersModule } from './features/users';
import { initializeSystemMemoryModule } from './features/system-memory';
import { initializeAssetsModule } from './features/assets';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8081;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting (Basic protection for BFF)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Initialize Shared Infrastructure (Core)
const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
});

// Initialize Features (Modules)
const authRouter = initializeAuthModule();
const copilotRouter = initializeCopilotModule();
const timelineRouter = initializeTimelineModule(firestore);
const usersRouter = initializeUsersModule(firestore);
const systemMemoryRouter = initializeSystemMemoryModule(firestore);
const assetsRouter = initializeAssetsModule(firestore);

// Mount Routes
app.use('/api/v1/dashboard/auth', authRouter);
app.use('/api/v1/dashboard/copilot', copilotRouter);
// Note: Timeline handles /metrics and /posts
app.use('/api/v1/dashboard', timelineRouter);
app.use('/api/v1/dashboard/users', usersRouter);
app.use('/api/v1/dashboard/memory', systemMemoryRouter);
app.use('/api/v1/dashboard/images', assetsRouter); // Matches HTML prototype / API Spec

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'dashboard-bff' });
});

// Start Server
app.listen(port, () => {
  console.log(`Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI.`);
});
