require('dotenv').config();
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const gemini = require('../src/services/gemini');
const { getWorkingMemory } = require('../src/core/memory');
const { buildSystemPrompt } = require('../src/core/contextInjector');

const DB_FILE = path.join(__dirname, '../local_db.json');

// Local DB Mock
const readDB = () => {
    if (fs.existsSync(DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) {
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
            const systemPrompt = buildSystemPrompt(userData, input);
            
            // Fetch Reply from Gemini
            const reply = await gemini.generateReply(systemPrompt, workingMemory, input);
            
            console.log(`\nレベッカ: ${reply}\n`);

            // Save to local JSON DB
            userData.episodicBuffer.push({ role: 'user', content: input, timestamp: new Date().toISOString() });
            userData.episodicBuffer.push({ role: 'model', content: reply, timestamp: new Date().toISOString() });
            userData.last_reply_date = new Date().toISOString();
            writeDB(userData);

        } catch (error) {
            console.error('\nエラーが発生しました:', error.message);
        }

        chatLoop();
    });
};

chatLoop();
