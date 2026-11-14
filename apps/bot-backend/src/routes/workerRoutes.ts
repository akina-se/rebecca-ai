import { Router } from 'express';
import { AppDependencies } from '../types';
import { workerAuth } from '../middleware/workerAuth';
import { handleControllerError } from '../utils/httpError';

import { createReplyTaskModule } from '../features/reply';
import { createSupportTaskModule } from '../features/support';

export const createWorkerRoutes = (deps: AppDependencies): Router => {
    const router = Router();

    // Secure all /worker endpoints
    router.use(workerAuth);

    router.use('/reply', createReplyTaskModule(deps));
    router.use('/support-post', createSupportTaskModule(deps));

    router.delete('/tweets/:id', async (req, res) => {
        const tweetId = req.params.id;
        try {
            await deps.xApi.deleteTweet(tweetId);
            res.status(200).json({ success: true, message: 'Tweet successfully deleted' });
        } catch (err) {
            handleControllerError(res, err, 'Worker Error: Failed to delete tweet');
        }
    });

    return router;
};
