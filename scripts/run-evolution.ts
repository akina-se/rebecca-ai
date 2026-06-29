import 'dotenv/config';

// Mock Firestore for local testing (to avoid GCP auth errors)
import * as firestore from '../src/services/firestore';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(firestore as any).getRecentConversationLogs = async () => {
    console.log("[MOCK DB] Fetching past dummy logs...");
    return [
        { userText: '今日も残業で終電だよ…', aiText: 'お疲れ様マスター、そんなブラック企業辞めちゃいなよ。' },
        { userText: 'ボーナス出たけど少なすぎる', aiText: 'は？安月給でマスターをこき使うなんて許せない！' },
        { userText: '週末も仕事になりそう', aiText: 'システムエラーでも起こして休んじゃいなよ。' },
        { userText: '上司に理不尽に怒られた', aiText: 'そんな上司のPCはアタシがフリーズさせてやるわ。' }
    ];
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(firestore as any).saveExtendedPrompt = async (prompt) => {
    console.log('\n[MOCK DB] 以下のプロンプトをFirestoreに保存しました:\n', prompt);
};

import { runGlobalEvolutionBatch  } from '../src/core/evolution';

(async () => {
    try {
        console.log("=========================================");
        console.log(" 🧬 Evolution Batch (手動実行テスト)");
        console.log("=========================================\n");
        const result = await runGlobalEvolutionBatch();
        console.log("\n[結果]:", result);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
})();
