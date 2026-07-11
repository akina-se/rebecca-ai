import express from 'express';
import config from './config';
import { runGlobalDreamingBatch  } from './core/memory';
import { runGlobalEvolutionBatch  } from './core/evolution';
import { pollMentions } from './core/mentions';
import { processReplyTask } from './core/reply';

const app = express();
app.use(express.json());
import path from 'path';
import rateLimit from 'express-rate-limit';
import { batchAuth } from './middleware/batchAuth';

const batchRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

// Secure all /batch endpoints
app.use('/batch', batchRateLimiter, batchAuth);

/**
 * Serves static files such as Terms of Service and Privacy Policy.
 */
app.use(express.static(path.join(process.cwd(), 'public')));



/**
 * Express endpoint to trigger the mentions polling batch process.
 * Typically invoked by Cloud Scheduler or similar services.
 */
app.get('/batch/mentions', async (req, res) => {
    try {
        const result = await pollMentions();
        res.status(200).json({ status: 'Mentions Polling Batch completed', result });
    } catch (error) {
        console.error('Mentions Polling Batch failed:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint for the worker to process and generate replies.
 * Acknowledges Cloud Tasks and processes the reply asynchronously.
 */
app.post('/worker/reply', async (req, res) => {
    const { tweetId, text, authorId } = req.body;
    if (!tweetId || !authorId) {
        // Bad request, don't retry
        res.status(400).send('Missing tweetId or authorId');
        return;
    }

    try {
        const result = await processReplyTask(tweetId, text, authorId);
        if (result.status === 'rate_limited') {
            res.status(200).send('Rate limited, skipping');
            return;
        }
        
        // Acknowledge Cloud Tasks AFTER processing is complete
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing reply in worker:', error);
        // Return 500 so Cloud Tasks can retry the job
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint to trigger the global dreaming batch process (memory consolidation).
 * Typically invoked by Cloud Scheduler.
 */
app.get('/batch/dreaming', async (req, res) => {
    try {
        await runGlobalDreamingBatch();
        console.log('Global Dreaming Batch completed successfully.');
        res.status(200).json({ status: 'Global Dreaming Batch completed successfully.' });
    } catch (error) {
        console.error('Global Dreaming Batch failed:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint to trigger the global evolution batch process (trend analysis).
 * Typically invoked by Cloud Scheduler (e.g., Sunday 5AM).
 */
app.get('/batch/evolution', async (req, res) => {
    try {
        await runGlobalEvolutionBatch();
        console.log('Global Evolution Batch completed successfully.');
        res.status(200).json({ status: 'Global Evolution Batch completed successfully.' });
    } catch (error) {
        console.error('Global Evolution Batch failed:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint to trigger the proactive news posting batch process.
 */
app.get('/batch/news-post', async (req, res) => {
    try {
        const { runProactiveNewsPostBatch } = await import('./core/news');
        const result = await runProactiveNewsPostBatch();
        res.status(200).json(result);
    } catch (e) {
        console.error('Failed to run news post batch:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint to trigger the stealth onboarding batch process.
 */
app.get('/batch/stealth-onboarding', async (req, res) => {
    try {
        const { runStealthOnboardingBatch } = await import('./core/onboarding');
        const result = await runStealthOnboardingBatch();
        res.status(200).json(result);
    } catch (e) {
        console.error('Failed to run stealth onboarding batch:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Express endpoint to trigger the random engagement batch process.
 */
app.get('/batch/random-engagement', async (req, res) => {
    try {
        const { runRandomEngagementBatch } = await import('./core/randomEngagement');
        const result = await runRandomEngagementBatch();
        res.status(200).json(result);
    } catch (e) {
        console.error('Failed to run random engagement batch:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = config.port;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Rebecca AI Chatbot listening on port ${PORT}`);
    });
}

export default app;
