import request from 'supertest';
import express from 'express';
import { createWorkerRoutes } from '../../src/routes/workerRoutes';
import { AppDependencies, IXApiService } from '../../src/types';
import config from '../../src/config';

describe('Worker Routes - Tweets Management', () => {
    let app: express.Application;
    let mockXApi: jest.Mocked<Pick<IXApiService, 'deleteTweet'>>;
    let mockDeps: AppDependencies;

    beforeEach(() => {
        jest.clearAllMocks();
        mockXApi = {
            deleteTweet: jest.fn().mockResolvedValue(true),
        };
        mockDeps = {
            xApi: mockXApi as unknown as IXApiService,
            firestore: {} as any,
            gemini: {} as any,
            persona: {} as any,
            tasks: {} as any,
            storage: {} as any,
        };

        config.batchSecret = 'test-secret';
        config.gcp.workerUrl = undefined; // Secret-only mode for unit tests

        app = express();
        app.use(express.json());
        app.use('/worker', createWorkerRoutes(mockDeps));
    });

    it('DELETE /worker/tweets/:id should successfully delete a tweet when authenticated', async () => {
        mockXApi.deleteTweet.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/worker/tweets/123456789')
            .set('x-worker-secret', 'test-secret');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, message: 'Tweet successfully deleted' });
        expect(mockXApi.deleteTweet).toHaveBeenCalledWith('123456789');
    });

    it('DELETE /worker/tweets/:id should reject unauthenticated requests with 401', async () => {
        const res = await request(app)
            .delete('/worker/tweets/123456789')
            .set('x-worker-secret', 'wrong-secret');

        expect(res.status).toBe(401);
        expect(mockXApi.deleteTweet).not.toHaveBeenCalled();
    });

    it('DELETE /worker/tweets/:id should handle deletion errors gracefully', async () => {
        mockXApi.deleteTweet.mockRejectedValueOnce(new Error('X API Error: Tweet not found'));

        const res = await request(app)
            .delete('/worker/tweets/123456789')
            .set('x-worker-secret', 'test-secret');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, message: 'X API Error: Tweet not found' });
    });
});
