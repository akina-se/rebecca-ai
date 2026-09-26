/**
 * Application Entry Point.
 * 
 * Initializes the Express application, wires dependencies, configures middlewares,
 * mounts routers for batch and worker operations, and starts the HTTP server.
 */
import express from 'express';
import path from 'path';
import config from './config';
import * as firestoreService from './services/firestore';
import { GeminiService } from './services/gemini';
import { XApiService } from './services/xApi';
import * as tasksService from './services/tasks';
import * as storageService from './services/storage';
import { getActivePersona } from '@rebecca/persona';
import { AppDependencies } from './types';

import { createBatchRoutes } from './routes/batchRoutes';
import { createWorkerRoutes } from './routes/workerRoutes';
import { publicRateLimiter, batchRateLimiter, workerRateLimiter } from './middleware/apiRateLimiter';
import { logger } from './utils/logger';
import { startGrpcServer } from './services/grpcServer';

/**
 * Instantiates the default application dependencies using configured settings.
 */
export const createDefaultDependencies = (): AppDependencies => ({
  firestore: firestoreService,
  gemini: new GeminiService({
    ...config.gemini,
    appTimezone: config.appTimezone,
  }),
  xApi: new XApiService(config.xApi),
  tasks: tasksService,
  storage: storageService,
  persona: getActivePersona(config.persona.activeId),
});

/**
 * Creates and configures the Express application instance with dependency injection.
 *
 * @param customDeps - Optional partial overrides for application dependencies.
 * @returns Configured Express application instance.
 */
export const createApp = (customDeps?: Partial<AppDependencies>): express.Express => {
  const deps: AppDependencies = {
    ...createDefaultDependencies(),
    ...customDeps,
  };

  const app = express();
  app.set('trust proxy', 1); // Trust the first proxy (e.g. Google Cloud Run) to fix express-rate-limit errors
  app.use(express.json());

  // Serve static files such as Terms of Service and Privacy Policy
  // Apply public rate limiter to static files or any other public entry points
  app.use(publicRateLimiter);
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Mount routes with specific rate limiters
  app.use('/batch', batchRateLimiter, createBatchRoutes(deps));
  app.use('/worker', workerRateLimiter, createWorkerRoutes(deps));

  return app;
};

const defaultDeps = createDefaultDependencies();
const app = createApp(defaultDeps);

const PORT = config.port;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info('Rebecca AI Chatbot server started', { port: PORT });
  });
  startGrpcServer(defaultDeps.xApi);
}

export default app;

