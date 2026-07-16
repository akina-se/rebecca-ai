import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { Firestore } from '@google-cloud/firestore';
import { initializeStatsModule } from './features/stats';

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

// 1. Initialize Shared Infrastructure (Core)
const firestore = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
});

// 2. Initialize Features (Modules)
const statsRouter = initializeStatsModule(firestore);

// 3. Mount Routes
app.use('/api/v1/dashboard/stats', statsRouter);

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'dashboard-bff' });
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI.`);
});
