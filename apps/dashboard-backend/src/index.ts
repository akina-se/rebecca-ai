import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { DIContainer } from './di/container';

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Setup Dependency Injection Container
const container = new DIContainer();

// API Routes
app.use('/api/v1/dashboard', container.dashboardRouter);

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'dashboard-bff' });
});

// Start Server
app.listen(port, () => {
  console.log(`🚀 Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with strict DI (Clean Architecture). Infrastructure is decoupled.`);
});
