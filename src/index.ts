import express from 'express';
import crypto from 'crypto';
import config from './config';
import { getWorkingMemory, saveInteraction, runGlobalDreamingBatch  } from './core/memory';
import { runGlobalEvolutionBatch  } from './core/evolution';
import { buildSystemPrompt  } from './core/contextInjector';
import { checkAndIncrementRateLimits  } from './core/rateLimiter';
import * as firestore from './services/firestore';
import * as gemini from './services/gemini';
import * as xApi from './services/xApi';
import * as tasks from './services/tasks';

const app = express();
app.use(express.json());
// Serve static files (Terms of Service, Privacy Policy)
import path from 'path';
app.use(express.static(path.join(process.cwd(), 'public')));

// X Webhook CRC (Challenge-Response Check)
app.get('/webhook/x', (req, res) => {
    const crcToken = req.query.crc_token as string;
    if (crcToken) {
        const hash = crypto.createHmac('sha256', config.xApi.appSecret)
            .update(crcToken)
            .digest('base64');
        res.status(200).json({ response_token: `sha256=${hash}` });
    } else {
        res.status(400).send('Error: crc_token missing');
    }
});

// X Webhook Receiver
app.post('/webhook/x', async (req, res) => {
    // Quick acknowledge to prevent X API timeout
    res.status(200).send('OK');

    const payload = req.body;
    console.log("Received webhook payload:", JSON.stringify(payload).substring(0, 500));
    
    let tweetId, text, authorId, screenName;

    if (payload.tweet_create_events && payload.tweet_create_events.length > 0) {
        const event = payload.tweet_create_events[0];
        tweetId = event.id_str;
        text = event.text;
        authorId = event.user?.id_str;
        screenName = event.user?.screen_name;
    } else {
        // Fallback for other structures
        tweetId = payload.tweet_id || payload.data?.id;
        text = payload.text || payload.data?.text;
        authorId = payload.author_id || payload.data?.author_id;
        screenName = payload.data?.author_id; // Just a fallback
    }

    if (!tweetId || !text || !authorId) {
        console.log("Missing tweet data. Ignoring.");
        return;
    }
    if (screenName === config.xApi.myUserId || authorId === config.xApi.myUserId) {
        console.log("Self mention. Ignoring.");
        return; 
    }

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
        let isFirstTime = false;
        if (!userData) {
            userData = { episodicBuffer: [], coreProfile: {} };
            isFirstTime = true;
        }

        if (isFirstTime) {
            try {
                // 初回のみXのプロフィール文を解析してcoreProfileの初期値を作成
                const profileRes = await xApi.getUserProfile(authorId);
                const desc = profileRes?.data?.description;
                if (desc) {
                    const parsedProfile = await gemini.analyzeUserProfile(desc);
                    userData.coreProfile = parsedProfile;
                    // プロフィールを読んだことをほのめかす履歴を1件注入
                    userData.episodicBuffer.push({ role: 'model', content: 'アンタのプロフィール文、舐めるように見といたわ。これからよろしくね。' });
                }
            } catch(e) {
                console.error("Failed to fetch/analyze user profile on first time", e);
            }
        }

        const workingMemory = getWorkingMemory(userData.episodicBuffer);

        // 3. RAG Retrieval & Context Injection (Build prompt)
        const extendedPrompt = await firestore.getExtendedPrompt();
        const timelineSummary = await firestore.getTimelineSummary();
        
        let ragMemories = [];
        const query = await gemini.generateSearchQuery(text, workingMemory);
        if (query) {
            const queryEmb = await gemini.generateEmbedding(query);
            ragMemories = await firestore.findRagMemories(authorId, queryEmb);
        }

        const lang = await gemini.detectLanguage(text);
        const systemPrompt = buildSystemPrompt(userData, text, extendedPrompt, timelineSummary, ragMemories, lang);

        // 4. Generate AI Reply
        const aiResponseText = await gemini.generateReply(systemPrompt, workingMemory, text);

        // 5. Post to X
        await xApi.replyToMention(tweetId, aiResponseText);

        // 6. Save Interaction to Memory (Working Memory / Episodic Buffer)
        await saveInteraction(authorId, text, aiResponseText);

        // 6.5. Save RAG Memory (Long-term Episodic Vector)
        const combinedText = `User: ${text}\nRebecca: ${aiResponseText}`;
        const memoryVector = await gemini.generateEmbedding(combinedText);
        if (memoryVector && memoryVector.length > 0) {
            await firestore.saveRagMemory(authorId, combinedText, memoryVector);
        }

        // 7. Save Raw Log for Analysis
        await firestore.saveRawConversationLog(authorId, text, aiResponseText);

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

// Batch process for Evolution (Trend Analysis)
app.get('/batch/evolution', async (req, res) => {
    // Triggered by Cloud Scheduler (e.g. Sunday 5AM)
    res.status(200).send('Evolution Batch started');
    try {
        await runGlobalEvolutionBatch();
        console.log('Global Evolution Batch completed successfully.');
    } catch (error) {
        console.error('Global Evolution Batch failed:', error);
    }
});

// News Periodic Post Batch Endpoint
app.get('/batch/news-post', async (req, res) => {
    try {
        const { runProactiveNewsPostBatch } = await import('./core/news');
        const result = await runProactiveNewsPostBatch();
        res.json(result);
    } catch (e) {
        console.error('Failed to run news post batch:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = config.port;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Rebecca AI Chatbot listening on port ${PORT}`);
    });
}

export default app;
