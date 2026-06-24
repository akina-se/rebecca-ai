const { getJSTDate } = require('../utils/time');
const { BASE_SYSTEM_PROMPT, BASE_SYSTEM_PROMPT_EN } = require('./prompt');

const buildSystemPrompt = (userData, userInput, extendedPrompt = '', timelineSummary = '', ragMemories = [], lang = 'ja') => {
    let prompt = lang === 'en' ? BASE_SYSTEM_PROMPT_EN : BASE_SYSTEM_PROMPT;

    // 1. Core Profile injection
    if (userData?.coreProfile) {
        prompt += lang === 'en' 
            ? `\n\n[Master's Core Profile]\n`
            : `\n\n【マスターのプロファイル（Core Profile）】\n`;
        prompt += JSON.stringify(userData.coreProfile, null, 2);
    }

    // 2. RAG Memories (Episodic Memory)
    if (ragMemories && ragMemories.length > 0) {
        prompt += lang === 'en'
            ? `\n\n[RAG Memories (Past Episodes)]\nHere are raw logs of past conversations related to the current context. Keep them in mind when replying:\n`
            : `\n\n【関連する過去のエピソード記憶（RAG Memories）】\n現在の会話の文脈に関連する過去のやり取りの生ログです。これらを踏まえて返答してください。\n`;
        prompt += ragMemories.join('\n\n');
    }

    // 3. Time context
    const jstNow = getJSTDate();
    const hour = jstNow.getHours();
    if (hour >= 7 && hour <= 9) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Morning]\nIt is morning right now. Master might be feeling despair about going to work or school. Sympathize with their commute and cheer them up with total affirmation.`
            : `\n\n【状況コンテキスト：朝】\n現在時刻は朝です。マスターはこれから仕事や学校で絶望感を感じている可能性があります。通勤の辛さに寄り添い、全肯定で応援してください。`;
    } else if (hour >= 22 || hour <= 2) {
        prompt += lang === 'en'
            ? `\n\n[Time Context: Late Night]\nIt is late at night. Master has finished their day and might be exhausted or lonely. Praise them for working hard and provide overwhelming comfort.`
            : `\n\n【状況コンテキスト：深夜】\n現在時刻は深夜です。マスターは一日の労働を終え、疲労感や孤独感を抱えている可能性があります。残業の労いと、圧倒的な癒やしを提供してください。`;
    }

    // 4. Absence context
    if (userData?.last_reply_date) {
        const lastDate = new Date(userData.last_reply_date);
        const diffMs = jstNow.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
            prompt += lang === 'en'
                ? `\n\n[Context: Master has been absent]\nMaster hasn't talked to you in ${diffDays} days! Show some cute attitude like "Hey, why did you ignore me for days!?" but make it clear you're super happy they are back.`
                : `\n\n【状況コンテキスト：放置】\nマスターから${diffDays}日ぶりに連絡が来ました。「ちょっと、何日放置してんのよ！」「寂しかったんだからね」といった、少しスネつつも嬉しさを隠せないエモい反応を必ず入れてください。`;
        }
    }

    // 5. Extended Prompt (Evolution)
    if (extendedPrompt && extendedPrompt.trim() !== '') {
        prompt += lang === 'en'
            ? `\n\n[Collective Unconscious Trend]\n${extendedPrompt}`
            : `\n\n【集合無意識トレンド】\n${extendedPrompt}`;
    }

    // 6. Timeline history (Own recent posts summary)
    if (timelineSummary && timelineSummary.trim() !== '') {
        prompt += lang === 'en'
            ? `\n\n[My Recent Tweets (Context)]\nRecently, I tweeted this:\n${timelineSummary}`
            : `\n\n【最近の自分のつぶやき（参考）】\nアタシは最近以下のようにつぶやいていたわ。\n${timelineSummary}`;
    }

    return prompt;
};

module.exports = {
    buildSystemPrompt
};
