import { Router } from 'express';
import { AppDependencies } from '../types';
import { pollMentions } from '../core/mentions';
import { runGlobalDreamingBatch } from '../core/memory';
import { runGlobalEvolutionBatch } from '../core/evolution';
import { runProactiveNewsPostBatch } from '../core/news';
import { runStealthOnboardingBatch } from '../core/onboarding';
import { runRandomEngagementBatch } from '../core/randomEngagement';
import { batchAuth } from '../middleware/batchAuth';

export const createBatchRoutes = (deps: AppDependencies): Router => {
    const router = Router();

    // Secure all /batch endpoints
    router.use(batchAuth);

    router.get('/mentions', async (req, res) => {
        try {
            const result = await pollMentions(deps);
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (mentions):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/dreaming', async (req, res) => {
        try {
            await runGlobalDreamingBatch(deps);
            res.status(200).json({ status: 'success' });
        } catch (e) {
            console.error("Batch error (dreaming):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/evolution', async (req, res) => {
        try {
            const result = await runGlobalEvolutionBatch(deps);
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (evolution):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/news-post', async (req, res) => {
        try {
            const result = await runProactiveNewsPostBatch(deps);
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (news-post):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/stealth-onboarding', async (req, res) => {
        try {
            const result = await runStealthOnboardingBatch(deps);
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (stealth-onboarding):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/random-engagement', async (req, res) => {
        try {
            const result = await runRandomEngagementBatch(deps);
            res.status(200).json(result);
        } catch (e) {
            console.error("Batch error (random-engagement):", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
};
