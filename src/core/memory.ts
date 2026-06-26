import * as firestore from '../services/firestore';
import * as gemini from '../services/gemini';
import { getDreamingPrompt  } from './prompt';

// 1. Working Memory: Sliding window of last 10-15 interactions from Episodic Buffer
const getWorkingMemory = (episodicBuffer, limit = 10) => {
    if (!episodicBuffer || episodicBuffer.length === 0) return [];
    // We want the last `limit` pairs.
    return episodicBuffer.slice(-limit * 2); 
};

// 2. Append to Episodic Buffer
const saveInteraction = async (userId, userText, modelText) => {
    await firestore.appendEpisodicBuffer(userId, { role: 'user', content: userText, timestamp: new Date().toISOString() });
    await firestore.appendEpisodicBuffer(userId, { role: 'model', content: modelText, timestamp: new Date().toISOString() });
};

// 3. Dreaming: Batch process to update Core Profile
const processDreamingForUser = async (userId, userData) => {
    const { episodicBuffer, coreProfile } = userData;
    if (!episodicBuffer || episodicBuffer.length === 0) {
        return; // Nothing to integrate
    }

    const systemPrompt = getDreamingPrompt();
    try {
        const newCoreProfile = await gemini.generateDreaming(systemPrompt, episodicBuffer, coreProfile);
        await firestore.updateCoreProfile(userId, newCoreProfile);
        console.log(`Dreaming completed for user: ${userId}`);
    } catch (error) {
        console.error(`Dreaming failed for user: ${userId}`, error);
    }
};

const runGlobalDreamingBatch = async () => {
    // 1. 各ユーザーのパーソナルな記憶を統合
    const users = await firestore.getAllUsers();
    for (const user of users) {
        await processDreamingForUser(user.id, user);
    }

    // 2. 自身の自発ポスト履歴（Timeline）を統合
    try {
        const recentPosts = await firestore.getRecentTimelinePosts(10);
        if (recentPosts.length > 0) {
            const previousSummary = await firestore.getTimelineSummary();
            const newSummary = await gemini.generateTimelineSummary(recentPosts, previousSummary);
            await firestore.saveTimelineSummary(newSummary);
            console.log("Timeline summary updated:", newSummary);
        }
    } catch (e) {
        console.error("Failed to summarize timeline", e);
    }
};

export { 
    getWorkingMemory,
    saveInteraction,
    runGlobalDreamingBatch,
    processDreamingForUser
 };
