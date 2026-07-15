import 'dotenv/config';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import * as gemini from '../src/services/gemini';
import { getWorkingMemory  } from '../src/core/memory';
import { buildSystemPrompt  } from '../src/core/contextInjector';

const DB_FILE = path.join(__dirname, '../local_db.json');
const RAW_LOG_FILE = path.join(__dirname, '../local_raw_logs.jsonl');

const appendRawLog = (userId, userText, aiText) => {
    const entry = JSON.stringify({ userId, userText, aiText, timestamp: new Date().toISOString() }) + '\n';
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
    return { episodicBuffer: [], coreProfile: {}, last_reply_date: null };
};

const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("==================================================");
console.log(" レベッカ ローカルチャット（スタンドアロンモード）");
console.log(" 終了するには 'exit' または 'quit' と入力してください");
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
            // Get extended prompt mock or real
            const extendedPrompt = '';
            // If this is running standalone, we could mock or fetch from DB. 
            // For local testing without GCP credentials, we'll just mock it or try to fetch.
            // We'll leave it empty for basic chat tests unless configured.

            const systemPrompt = buildSystemPrompt('reply', userData, input, extendedPrompt);
            
            // Fetch Reply from Gemini
            const reply = await gemini.generateReply(systemPrompt, workingMemory, input);
            
            console.log(`\nレベッカ: ${reply}\n`);

            // Save to local JSON DB
            userData.episodicBuffer.push({ role: 'user', content: input, timestamp: new Date().toISOString() });
            userData.episodicBuffer.push({ role: 'model', content: reply, timestamp: new Date().toISOString() });
            userData.last_reply_date = new Date().toISOString();
            writeDB(userData);

            // Append to local raw logs for analytics
            appendRawLog('local_user', input, reply);

        } catch (error) {
            console.error('\nエラーが発生しました:', error.message);
        }

        chatLoop();
    });
};

chatLoop();
