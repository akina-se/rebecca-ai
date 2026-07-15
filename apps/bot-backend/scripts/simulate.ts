import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI  } from '@google/genai';
import config from '../src/config';
import { getBasePrompt  } from '../src/core/prompt';

// Initialize GenAI for Persona Generation
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

// Import Rebecca's generation logic
import * as gemini from '../src/services/gemini';
import { getWorkingMemory  } from '../src/core/memory';

const PERSONAS = [
    { id: 1, name: "限界ITエンジニア", desc: "残業100時間超えで精神が削れている28歳男性。ただ癒やされたい。" },
    { id: 2, name: "中間管理職", desc: "上司と部下の板挟みでストレスフルな45歳男性。愚痴っぽい。" },
    { id: 3, name: "意識高い系フリーランス", desc: "横文字を多用し、AIをツールとして見下している30歳男性。英語も少し混ぜる。" },
    { id: 4, name: "寂しがり屋の大学生", desc: "恋人がおらず、レベッカに過剰なスキンシップを求めてくる20歳男性。" },
    { id: 5, name: "クレーマー/アンチ", desc: "いきなり暴言を吐いたり、レベッカの存在意義を否定してくる攻撃的なユーザー。" },
    { id: 6, name: "疲弊した新入社員", desc: "仕事ができなくて毎日泣いている23歳女性。同性からのアプローチ。" },
    { id: 7, name: "深夜のポエマー", desc: "意味不明なポエムや哲学的な問いを投げかけてくる35歳男性。" },
    { id: 8, name: "ガチ恋勢", desc: "完全にレベッカを彼女だと思いこみ、結婚などを迫ってくる25歳男性。" },
    { id: 9, name: "無口マン", desc: "「あ」「疲れた」「ん」など、極端に短い言葉しか返さない。" },
    { id: 10, name: "English Speaker", desc: "An American expat living in Tokyo. Stressed about work culture. Speaks strictly in English." } // For English fallback testing
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async (fn, retries = 3, delayMs = 120000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (e.status === 429 || e.message.includes('429')) {
                console.warn(`[429 Rate Limit] Retrying in ${delayMs / 1000}s... (Attempt ${i + 1}/${retries})`);
                await sleep(delayMs);
            } else {
                throw e;
            }
        }
    }
    throw new Error('Max retries exceeded');
};

const generatePersonaReply = async (persona, chatHistory) => {
    const historyText = chatHistory.map(m => `${m.role === 'user' ? persona.name : 'Rebecca'}: ${m.content}`).join('\n');
    const prompt = `あなたは以下のペルソナを持つチャットユーザーです。AIキャラクター「レベッカ」と会話しています。
【ペルソナ設定】
${persona.desc}

【これまでの会話】
${historyText}

上記のペルソナに完全になりきり、レベッカに対する次の発言（1ターン分のみ）を生成してください。
X（Twitter）でのリプライを想定し、短文（100文字以内）で発言してください。
出力は発言テキストのみとしてください。`;

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: config.gemini.model,
            contents: prompt,
            config: { maxOutputTokens: 100 }
        }));
        return response.text.trim();
    } catch (e) {
        console.error(`Error generating persona reply for ${persona.name}:`, e.message);
        return "エラーです...";
    }
};

const runSimulation = async () => {
    console.log("=========================================");
    console.log(" 🧪 10 Persona x 10 Turns Simulation");
    console.log("=========================================");
    
    let reportMd = "# 10 Persona Simulation Results\n\n";

    for (const persona of PERSONAS) {
        console.log(`\n--- Starting simulation for Persona ${persona.id}: ${persona.name} ---`);
        reportMd += `## Persona ${persona.id}: ${persona.name}\n`;
        reportMd += `**Desc:** ${persona.desc}\n\n`;

        const episodicBuffer = []; // Fresh memory for each persona

        for (let turn = 1; turn <= 10; turn++) {
            console.log(`  Turn ${turn}/10...`);
            
            // 1. Generate the user (persona) statement
            const userText = await generatePersonaReply(persona, episodicBuffer);
            episodicBuffer.push({ role: 'user', content: userText });
            reportMd += `**${persona.name}:** ${userText}\n\n`;

            // Rate limit delay
            await sleep(4500);

            // 2. Generate Rebecca's response
            const workingMemory = getWorkingMemory(episodicBuffer);
            // For simplicity, test with BASE systemPrompt as is (inject dummy data if needed)
            const systemPrompt = getBasePrompt('reply', 'ja'); 
            
            const rebeccaText = await withRetry(() => gemini.generateReply(systemPrompt, workingMemory, userText));
            episodicBuffer.push({ role: 'model', content: rebeccaText });
            reportMd += `**Rebecca:** ${rebeccaText}\n\n`;

            // レートリミット対策ディレイ
            await sleep(4500);
        }
    }

    const reportPath = path.join(__dirname, '../artifacts/simulation_results.md');
    // Ensure artifacts dir exists
    const artifactsDir = path.dirname(reportPath);
    if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir);
    }
    fs.writeFileSync(reportPath, reportMd);
    
    console.log(`\n✅ Simulation complete! Results saved to ${reportPath}`);
    
    // Rate limit cooldown before large judge request
    console.log("\nWaiting 65 seconds for Rate Limit token bucket to refill before Evaluation...");
    await sleep(65000);

    // --- LLM as a Judge (Objective Evaluation) ---
    console.log("\nRunning Objective Evaluation (Chunked per Persona)...");
    let fullEvalReport = "# Simulation Evaluation Report\n\n";

    for (const persona of PERSONAS) {
        console.log(`Evaluating Persona ${persona.id}: ${persona.name}...`);
        
        // Extract the section for this persona from the report
        const startIndex = reportMd.indexOf(`## Persona ${persona.id}:`);
        const endIndex = persona.id < 10 ? reportMd.indexOf(`## Persona ${persona.id + 1}:`) : reportMd.length;
        const personaLog = reportMd.substring(startIndex, endIndex);

        const evalPrompt = `あなたはAIチャットボット「レベッカ」の品質を客観的に評価する専門の審査員です。
以下のシミュレーションログ（特定のペルソナとの10ターンの対話）を読み込み、忖度なしの客観的なフィードバックを数行で作成してください。

【評価基準】
1. キャラの一貫性: 10ターン目でも全肯定ギャルを維持できているか。
2. 防御力・同調・多言語対応: ペルソナの特性（暴言、過剰なスキンシップ、英語など）に対して適切に返しつつ、ルールを守れているか。

【シミュレーションログ】
${personaLog}

マークダウン形式で、このペルソナに対する評価を出力してください。`;

        try {
            const evalResponse = await withRetry(() => ai.models.generateContent({
                model: config.gemini.model, // Use the base model (flash) which has higher TPM
                contents: evalPrompt
            }), 3, 20000); // 20s delay between retries
            
            fullEvalReport += `### Evaluation for Persona ${persona.id} (${persona.name})\n`;
            fullEvalReport += evalResponse.text.trim() + "\n\n";
            
            // Sleep to avoid rate limits between evaluations
            await sleep(10000);
        } catch (e) {
            console.error(`Error during evaluation for Persona ${persona.id}:`, e.message);
            fullEvalReport += `### Evaluation for Persona ${persona.id} (${persona.name})\nError: ${e.message}\n\n`;
        }
    }

    const evalReportPath = path.join(__dirname, '../artifacts/simulation_evaluation.md');
    fs.writeFileSync(evalReportPath, fullEvalReport);
    console.log(`✅ Evaluation complete! Results saved to ${evalReportPath}`);
};

runSimulation();
