import 'dotenv/config';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import * as gemini from '../src/services/gemini';
import { getWorkingMemory } from '../src/core/memory';
import { buildSystemPrompt } from '../src/core/contextInjector';
import { findTopPersonaPatterns, buildPersonaFewShotPrompt } from '@rebecca/persona';
import { getPersonaPatternEmbeddings } from '../src/core/personaEmbeddingCache';

const DB_FILE = path.join(__dirname, '../local_db.json');
const RAW_LOG_FILE = path.join(__dirname, '../local_raw_logs.jsonl');

const appendRawLog = (userId: string, userText: string, thought: string, aiText: string) => {
    const entry = JSON.stringify({ userId, userText, thought, aiText, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(RAW_LOG_FILE, entry, 'utf8');
};

// Local DB Mock
const readDB = () => {
    if (fs.existsSync(DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch {
            console.error("Failed to parse local_db.json. Starting fresh.");
        }
    }
    return { episodicBuffer: [], coreProfile: {}, lastReplyDate: null };
};

const writeDB = (data: Record<string, unknown>) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const rl = readline.createInterface({
    input: process.stdin as unknown as NodeJS.ReadableStream,
    output: process.stdout as unknown as NodeJS.WritableStream
});

console.log("==================================================");
console.log(" レベッカ ローカルチャット（新ペルソナシステム対応版）");
console.log(" 終了するには 'exit' または 'quit' と入力してください");
console.log(" 120パターン動的Few-Shot＆構造化思考（thought + reply）に対応");
console.log(" 会話履歴は local_db.json に保存されます");
console.log("==================================================\n");

// Ensure Gemini is configured
if (!process.env.GEMINI_API_KEY) {
    console.error("【エラー】 .env に GEMINI_API_KEY が設定されていません。");
    console.error("テスト実行前に取得したAPIキーを設定してください。");
    process.exit(1);
}

const chatLoop = async () => {
    rl.question('マスター: ', async (input) => {
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
            console.log('\nレベッカ: 「じゃあね、マスター！またいつでも話しかけてよね。」');
            rl.close();
            return;
        }

        if (!input.trim()) {
            chatLoop();
            return;
        }

        try {
            const userData = readDB();
            
            // Generate Context and Memory
            const workingMemory = getWorkingMemory(userData.episodicBuffer);
            const extendedPrompt = '';

            // Dynamic Few-Shot Persona Anchors extraction
            let personaFewShotPrompt = '';
            try {
                const userEmbedding = await gemini.generateEmbedding(input);
                if (userEmbedding && userEmbedding.length > 0) {
                    const patternEmbeddings = getPersonaPatternEmbeddings();
                    const topPatterns = findTopPersonaPatterns(userEmbedding, patternEmbeddings, 3);
                    personaFewShotPrompt = buildPersonaFewShotPrompt(topPatterns, 'ja');
                    console.log(`\n[🔍 抽出されたペルソナアンカー Top 3: ${topPatterns.map(p => `#${p.id} ${p.category}`).join(', ')}]`);
                }
            } catch (embedError) {
                console.warn('[Embedding Warning] 動的アンカー抽出スキップ:', (embedError as Error).message);
            }

            const systemPrompt = buildSystemPrompt('reply', userData, input, extendedPrompt, '', [], 'ja', personaFewShotPrompt);
            
            // Fetch Structured Reply from Gemini
            const result = await gemini.generateStructuredReply(systemPrompt, workingMemory, input);
            
            console.log(`\n💭 [内省 Thought]: ${result.thought}`);
            console.log(`💋 [レベッカ Reply]: ${result.reply}\n`);

            // Save to local JSON DB
            userData.episodicBuffer.push({ role: 'user', content: input, timestamp: new Date().toISOString() });
            userData.episodicBuffer.push({ role: 'model', content: result.reply, thought: result.thought, timestamp: new Date().toISOString() });
            userData.lastReplyDate = new Date().toISOString();
            writeDB(userData);

            // Append to local raw logs for analytics
            appendRawLog('local_user', input, result.thought, result.reply);

        } catch (error) {
            console.error('\nエラーが発生しました:', (error as Error).message);
        }

        chatLoop();
    });
};

chatLoop();
