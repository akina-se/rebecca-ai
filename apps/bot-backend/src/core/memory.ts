import { AppDependencies } from '../types';
import { ConversationLogEntry } from '../types';

/**
 * Extracts a sliding window of recent interactions from the episodic buffer.
 * 
 * @param episodicBuffer - The full array of conversation log entries.
 * @param limit - The number of interaction pairs to retrieve. Defaults to 10.
 * @returns An array containing the recent conversation log entries.
 */
const getWorkingMemory = (episodicBuffer: ConversationLogEntry[] | undefined, limit = 10): ConversationLogEntry[] => {
    if (!episodicBuffer?.length) return [];
    return episodicBuffer.slice(-limit * 2); 
};

/**
 * Appends user and model interactions to the episodic buffer.
 * 
 * @param deps - The application dependencies including the firestore service.
 * @param userId - The ID of the user.
 * @param userText - The text input from the user.
 * @param modelText - The text response from the model.
 * @returns A promise that resolves when both interactions have been successfully saved.
 */
const saveInteraction = async (deps: AppDependencies, userId: string, userText: string, modelText: string): Promise<void> => {
    await deps.firestore.appendEpisodicBuffer(userId, { role: 'user', content: userText, timestamp: new Date().toISOString() });
    await deps.firestore.appendEpisodicBuffer(userId, { role: 'model', content: modelText, timestamp: new Date().toISOString() });
};

export { 
    getWorkingMemory,
    saveInteraction
};
