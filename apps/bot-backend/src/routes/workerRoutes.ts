import { Router } from 'express';
import { AppDependencies } from '../types';
import { workerAuth } from '../middleware/workerAuth';

import { createReplyTaskModule } from '../features/reply';

export const createWorkerRoutes = (deps: AppDependencies): Router => {
    const router = Router();

    // Secure all /worker endpoints
    router.use(workerAuth);

    router.use('/reply', createReplyTaskModule(deps));

    return router;
};
