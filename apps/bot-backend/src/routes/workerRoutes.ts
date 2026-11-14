import { Router } from 'express';
import { AppDependencies } from '../types';
import { workerAuth } from '../middleware/workerAuth';

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
            let statusCode = 500;
            let detail: string | undefined;
            if (typeof err === 'object' && err !== null) {
                const rawStatus =
                    'status' in err && typeof err.status === 'number'
                        ? err.status
                        : 'statusCode' in err && typeof err.statusCode === 'number'
                            ? err.statusCode
                            : undefined;
                if (rawStatus !== undefined && rawStatus >= 400 && rawStatus <= 599) {
                    statusCode = rawStatus;
                }
                if ('data' in err && typeof err.data === 'object' && err.data !== null && 'detail' in err.data) {
                    const rawDetail = err.data.detail;
                    if (typeof rawDetail === 'string' && rawDetail.trim()) {
                        detail = rawDetail.trim();
                    }
                }
            }
            const message = detail ?? (err instanceof Error ? err.message : 'Unknown error');
            res.status(statusCode).json({ success: false, message });
        }
    });

    return router;
};
