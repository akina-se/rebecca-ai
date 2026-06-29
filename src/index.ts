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

// Core logic for mentions polling
const pollMentions = async () => {
    try {
        console.log("Polling mentions from X API...");
        const sinceId = await firestore.getLastMentionId();
        const mentionsRes = await xApi.getMentions(sinceId || undefined);
        
        if (!mentionsRes.data || mentionsRes.data.length === 0) {
            console.log("No new mentions found.");
            return { count: 0 };
        }

        console.log(`Found ${mentionsRes.data.length} new mentions.`);
        let newestId = sinceId;

        for (const tweet of mentionsRes.data) {
            const tweetId = tweet.id;
            const text = tweet.text;
            const authorId = tweet.author_id || tweet.authorId || (tweet as any).author?.id || (tweet as any).user?.id || (tweet as any).user_id;

            // Update newestId
            if (!newestId || BigInt(tweetId) > BigInt(newestId)) {
                newestId = tweetId;
            }

            if (!authorId) {
                console.warn(`Could not determine author ID for tweet ${tweetId}. Tweet object:`, JSON.stringify(tweet));
                continue;
            }

            // Ignore self-mentions
            if (authorId === config.xApi.myUserId) {
                console.log(`Ignoring self-mention ${tweetId}`);
                continue;
            }

            try {
                // Enqueue with intentional delay (60 to 180 seconds)
                const delaySeconds = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
                await tasks.enqueueReplyTask({
                    tweetId,
                    text,
                    authorId
                }, delaySeconds);
                console.log(`Enqueued mention ${tweetId} from ${authorId}`);
            } catch (e) {
                console.error(`Failed to enqueue task for mention ${tweetId}`, e);
            }
        }

        // Save the newest mention ID to avoid fetching them again
        if (newestId && newestId !== sinceId) {
            await firestore.setLastMentionId(newestId);
            console.log(`Updated last_mention_id to ${newestId}`);
        }

        return { count: mentionsRes.data.length, newestId };
    } catch (error) {
        console.error("Error during pollMentions:", error);
        throw error;
    }
};

// Endpoint to be triggered by Cloud Scheduler or similar services
app.get('/batch/mentions', async (req, res) => {
    try {
        const result = await pollMentions();
        res.status(200).json({ status: 'Mentions Polling Batch completed', result });
    } catch (error) {
        console.error('Mentions Polling Batch failed:', error);
        res.status(500).send('Mentions Polling Batch failed');
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
                // Analyze the user's X profile only on their first interaction to create the initial coreProfile
                const profileRes = await xApi.getUserProfile(authorId);
                const desc = profileRes?.data?.description;
                if (desc) {
                    const parsedProfile = await gemini.analyzeUserProfile(desc);
                    userData.coreProfile = parsedProfile;
                    // Inject a single history log hinting that the profile has been read
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
        
        // For periodic execution in environments like local (where Cloud Scheduler is unavailable)
        // Only active if POLLING_INTERVAL_MINUTES=60 or similar is set in .env
        if (process.env.POLLING_INTERVAL_MINUTES) {
            const intervalMinutes = parseInt(process.env.POLLING_INTERVAL_MINUTES, 10);
            if (!isNaN(intervalMinutes) && intervalMinutes > 0) {
                console.log(`Internal polling enabled: every ${intervalMinutes} minutes.`);
                setInterval(() => {
                    pollMentions().catch(e => console.error("Internal polling error:", e));
                }, intervalMinutes * 60 * 1000);
            }
        }
    });
}

export default app;
