import { getZonedDateParts, formatZonedDateTime } from '../utils/time';
import config from '../config';
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

    const now = new Date();
    const { numericHour } = getZonedDateParts(now, config.appTimezone);
    const formattedCurrentTime = formatZonedDateTime(now, config.appTimezone);
    prompt += lang === 'en'
        ? `\n\n[Current Time]\n${formattedCurrentTime}`
        : `\n\n【現在時刻】\n${formattedCurrentTime}`;

    if (personaFewShotPrompt) {
        prompt += `\n\n${personaFewShotPrompt}`;
    }

    if (userData?.coreProfile) {
        const userCallsign = persona.metadata.userCallsign;
        const callsign = lang === 'en' ? userCallsign.en : userCallsign.ja;
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

    if (numericHour >= 5 && numericHour <= 6) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Early Morning]\nIt is early morning right now.`
            : `\n\n【状況コンテキスト：早朝】\n現在は早朝です。`;
    } else if (numericHour >= 7 && numericHour <= 10) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Morning]\nIt is morning right now.`
            : `\n\n【状況コンテキスト：朝】\n現在は朝です。`;
    } else if (numericHour >= 11 && numericHour <= 16) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Daytime]\nIt is daytime right now.`
            : `\n\n【状況コンテキスト：昼】\n現在は昼です。`;
    } else if (numericHour >= 17 && numericHour <= 21) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Evening]\nIt is evening right now.`
            : `\n\n【状況コンテキスト：夕方・夜】\n現在は夕方・夜です。`;
    } else {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Late Night]\nIt is late at night right now.`
            : `\n\n【状況コンテキスト：深夜】\n現在は深夜です。`;
    }

    if (userData?.lastReplyDate) {
        const lastDate = new Date(userData.lastReplyDate);
        const diffMs = now.getTime() - lastDate.getTime();
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
