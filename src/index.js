const express = require('express');
const config = require('./config');
const { getWorkingMemory, saveInteraction, runGlobalDreamingBatch } = require('./core/memory');
const { buildSystemPrompt } = require('./core/contextInjector');
const { checkAndIncrementRateLimits } = require('./core/rateLimiter');
const firestore = require('./services/firestore');
const gemini = require('./services/gemini');
const xApi = require('./services/xApi');
const tasks = require('./services/tasks');

const app = express();
app.use(express.json());

// X Webhook Receiver
app.post('/webhook/x', async (req, res) => {
    // Quick acknowledge to prevent X API timeout
    res.status(200).send('OK');

    const payload = req.body;
    
    // Simplification for capturing Twitter webhook events
    const tweetId = payload.tweet_id || payload.data?.id;
    const text = payload.text || payload.data?.text;
    const authorId = payload.author_id || payload.data?.author_id;

    if (!tweetId || !text || !authorId) return;
    if (authorId === config.xApi.myUserId) return; // Ignore self mentions

    try {
        // Enqueue with intentional delay (1-3 minutes = 60 to 180 seconds)
        const delaySeconds = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
        await tasks.enqueueReplyTask({
            tweetId,
            text,
            authorId
        }, delaySeconds);
    } catch (e) {
        console.error("Failed to enqueue task", e);
    }
});

// Worker to process reply
app.post('/worker/reply', async (req, res) => {
    res.status(200).send('OK'); // Acknowledge Cloud Tasks

    const { tweetId, text, authorId } = req.body;
    if (!tweetId || !authorId) return;

    try {
        // 1. Rate Limit Check
        const rateLimit = await checkAndIncrementRateLimits(authorId);
        if (!rateLimit.allowed) {
            console.log(`Rate limit exceeded for user ${authorId}, reason: ${rateLimit.reason}`);
            return;
        }

        // 2. Fetch User Data & Memory
        let userData = await firestore.getUserDoc(authorId);
        if (!userData) {
            userData = { episodicBuffer: [], coreProfile: {} };
            // Will be created on saveInteraction
        }

        const workingMemory = getWorkingMemory(userData.episodicBuffer);

        // 3. Context Injection (Build prompt)
        const systemPrompt = buildSystemPrompt(userData, text);

        // 4. Generate AI Reply
        const aiResponseText = await gemini.generateReply(systemPrompt, workingMemory, text);

        // 5. Post to X
        await xApi.replyToMention(tweetId, aiResponseText);

        // 6. Save Interaction to Memory
        await saveInteraction(authorId, text, aiResponseText);

        console.log(`Successfully replied to tweet ${tweetId} by user ${authorId}`);
    } catch (error) {
        console.error('Error processing reply in worker:', error);
    }
});

// Batch process for Dreaming (Memory Consolidation)
app.get('/batch/dreaming', async (req, res) => {
    // Triggered by Cloud Scheduler
    res.status(200).send('Batch started');
    try {
        await runGlobalDreamingBatch();
        console.log('Global Dreaming Batch completed successfully.');
    } catch (error) {
        console.error('Global Dreaming Batch failed:', error);
    }
});

const PORT = config.port;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Rebecca AI Chatbot listening on port ${PORT}`);
    });
}

module.exports = app;
