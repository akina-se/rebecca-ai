import { Router } from 'express';
import { AppDependencies } from '../types';
import { processReplyTask } from '../core/reply';
import { workerAuth } from '../middleware/workerAuth';

export const createWorkerRoutes = (deps: AppDependencies): Router => {
    const router = Router();

    // Apply worker authentication to all routes in this router
    router.use(workerAuth);

    /**
     * POST /worker/reply
     * Endpoint for Cloud Tasks to trigger asynchronous replies.
     */
    router.post('/reply', async (req, res) => {
        const { tweetId, text, authorId } = req.body;
        
        if (!tweetId || !text || !authorId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        try {
            await processReplyTask(deps, tweetId, text, authorId);
            // Must return 200 to acknowledge task completion
            res.status(200).json({ status: 'success' });
        } catch (error) {
            console.error('Error in /worker/reply:', error);
            // Must return 200 or task will retry indefinitely depending on config
            // For now, return 500 so Cloud Tasks can retry it according to its retry policy
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
};
