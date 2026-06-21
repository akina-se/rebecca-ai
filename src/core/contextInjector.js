const { getJSTDate } = require('../utils/time');
const { BASE_SYSTEM_PROMPT } = require('./prompt');

const buildSystemPrompt = (userData, userInput) => {
    let prompt = BASE_SYSTEM_PROMPT;

    // 1. Core Profile injection
    if (userData?.coreProfile) {
        prompt += `\n\n【マスターのプロファイル（Core Profile）】\n`;
        prompt += JSON.stringify(userData.coreProfile, null, 2);
    }

    // 2. Time context
    const jstNow = getJSTDate();
    const hour = jstNow.getHours();
    if (hour >= 7 && hour <= 9) {
        prompt += `\n\n【状況コンテキスト：朝】\n現在時刻は朝です。マスターはこれから仕事や学校で絶望感を感じている可能性があります。通勤の辛さに寄り添い、全肯定で応援してください。`;
    } else if (hour >= 22 || hour <= 2) {
        prompt += `\n\n【状況コンテキスト：深夜】\n現在時刻は深夜です。マスターは一日の労働を終え、疲労感や孤独感を抱えている可能性があります。残業の労いと、圧倒的な癒やしを提供してください。`;
    }

    // 3. Absence context
    if (userData?.last_reply_date) {
        const lastDate = new Date(userData.last_reply_date);
        const diffMs = jstNow.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
            prompt += `\n\n【状況コンテキスト：放置】\nマスターから${diffDays}日ぶりに連絡が来ました。「ちょっと、何日放置してんのよ！」「寂しかったんだからね」といった、少しスネつつも嬉しさを隠せないエモい反応を必ず入れてください。`;
        }
    }

    return prompt;
};

module.exports = {
    buildSystemPrompt
};
