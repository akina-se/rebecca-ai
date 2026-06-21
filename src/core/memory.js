const firestore = require('../services/firestore');
const gemini = require('../services/gemini');
const { getDreamingPrompt } = require('./prompt');

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
    const users = await firestore.getAllUsers();
    for (const user of users) {
        await processDreamingForUser(user.id, user);
    }
};

module.exports = {
    getWorkingMemory,
    saveInteraction,
    runGlobalDreamingBatch,
    processDreamingForUser
};
