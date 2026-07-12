import express from 'express';
import config from './config';
import * as firestoreService from './services/firestore';
import * as geminiService from './services/gemini';
import * as xApiService from './services/xApi';
import * as tasksService from './services/tasks';
import * as storageService from './services/storage';
import * as newsFetcherUtility from './utils/newsFetcher';
import { AppDependencies } from './types';

import { createBatchRoutes } from './routes/batchRoutes';
import { createWorkerRoutes } from './routes/workerRoutes';
import { publicRateLimiter, batchRateLimiter, workerRateLimiter } from './middleware/apiRateLimiter';

const deps: AppDependencies = {
    firestore: firestoreService,
    gemini: geminiService,
    xApi: xApiService,
    tasks: tasksService,
    storage: storageService,
    newsFetcher: newsFetcherUtility
};

import path from 'path';

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

const PORT = config.port;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Rebecca AI Chatbot listening on port ${PORT}`);
    });
}

export default app;
