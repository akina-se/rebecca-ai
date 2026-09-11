import { getJSTDate, formatJSTDateTime } from '../utils/time';
import { PromptContext, Language, IPersonaDefinition } from '@rebecca/persona';
import { FirestoreUser } from '../types';

/**
 * Builds the comprehensive system prompt by combining the base persona prompt
 * with various contextual injections such as core profile, episodic memories,
 * time of day, and timeline history.
 * 
 * @param persona - The active persona definition.
 * @param promptContext - The context in which the prompt is being used.
 * @param userData - The current user's profile and state from Firestore.
 * @param userInput - The user's input string.
 * @param extendedPrompt - An optional extended prompt generated through evolution.
 * @param timelineSummary - An optional summary of the AI's recent timeline activity.
 * @param ragMemories - Optional retrieved memories relevant to the current conversation.
 * @param lang - The language for the prompt, defaults to 'ja'.
 * @returns The fully constructed system prompt string.
 */
const buildSystemPrompt = (
    persona: IPersonaDefinition,
    promptContext: PromptContext, 
    userData: FirestoreUser | null, 
    userInput: string, 
    extendedPrompt = '', 
    timelineSummary = '', 
    ragMemories: string[] = [], 
    lang: Language = 'ja',
    personaFewShotPrompt = ''
): string => {
    let prompt = persona.getBasePrompt(promptContext, lang);

    const jstNow = getJSTDate();
    const formattedCurrentTime = formatJSTDateTime(new Date().toISOString());
    prompt += lang === 'en'
        ? `\n\n[Current Time (JST)]\n${formattedCurrentTime}`
        : `\n\n【現在時刻（JST）】\n${formattedCurrentTime}`;

    if (personaFewShotPrompt) {
        prompt += `\n\n${personaFewShotPrompt}`;
    }

    if (userData?.coreProfile) {
        const userCallsign = persona.metadata.userCallsign;
        const callsign = lang === 'en' ? (userCallsign?.en || "Master") : (userCallsign?.ja || "マスター");
        prompt += lang === 'en' 
            ? `\n\n[${callsign}'s Core Profile]\n`
            : `\n\n【${callsign}のプロファイル（Core Profile）】\n`;
        prompt += JSON.stringify(userData.coreProfile, null, 2);
    }

    if (ragMemories && ragMemories.length > 0) {
        prompt += lang === 'en'
            ? `\n\n[RAG Memories (Past Episodes)]\nHere are past conversation logs retrieved by topic similarity. Notice their recorded timestamps: they represent past history, distinct from the immediate conversation turns (Contents). Keep them in mind when replying:\n`
            : `\n\n【関連する過去のエピソード記憶（RAG Memories）】\n話題の類似度によって取得された過去の会話ログです。記録された日時に着目してください（直前の対話履歴Contentsとは異なり、過去の出来事です）。これらを踏まえて返答してください。\n`;
        prompt += ragMemories.join('\n\n');
    }

    const hour = jstNow.getHours();
    if (hour >= 7 && hour <= 9) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Morning (${hour}:00)]\nIt is morning right now.`
            : `\n\n【状況コンテキスト：朝】\n現在時刻は朝（${hour}時台）です。`;
    } else if (hour >= 22 || hour <= 2) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Late Night (${hour}:00)]\nIt is late at night right now.`
            : `\n\n【状況コンテキスト：深夜】\n現在時刻は深夜（${hour}時台）です。`;
    }

    if (userData?.lastReplyDate) {
        const lastDate = new Date(userData.lastReplyDate);
        const diffMs = jstNow.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
            const absenceInstruction = persona.formatAbsenceInstruction(diffDays, lang);
            prompt += lang === 'en'
                ? `\n\n[Context: Absence Reaction]\n${absenceInstruction}`
                : `\n\n【状況コンテキスト：放置】\n${absenceInstruction}`;
        }
    }

    if (extendedPrompt && extendedPrompt.trim() !== '') {
        prompt += lang === 'en'
            ? `\n\n[Collective Unconscious Trend]\n${extendedPrompt}`
            : `\n\n【集合無意識トレンド】\n${extendedPrompt}`;
    }

    if (timelineSummary && timelineSummary.trim() !== '') {
        const personaName = persona.metadata.displayName;
        prompt += lang === 'en'
            ? `\n\n[My Recent Posts (Context)]\nRecently, I posted this:\n${timelineSummary}`
            : `\n\n【最近の自分の投稿（参考）】\n${personaName}は最近以下のようにつぶやいていた。\n${timelineSummary}`;
    }

    return prompt;
};

export { 
    buildSystemPrompt
 };
