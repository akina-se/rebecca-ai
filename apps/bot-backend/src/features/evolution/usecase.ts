import { AppDependencies } from '../../types';
import config from '../../config';

/**
 * Represents the result of a global evolution execution.
 */
export interface EvolutionResult {
    status: 'skipped' | 'failed' | 'success' | 'rejected';
    reason?: string;
    prompt?: string;
    candidate?: string;
}

/**
 * Use case responsible for orchestrating the global evolution batch process.
 * It periodically updates the AI's persona based on recent user interactions by fetching logs,
 * generating candidate prompts, and auditing them for safety.
 */
export class GlobalEvolutionUseCase {
    /**
     * Initializes a new instance of the GlobalEvolutionUseCase.
     * 
     * @param deps - The application dependencies required to execute the evolution process (e.g., Firestore, Gemini).
     */
    constructor(private deps: AppDependencies) {}

    /**
     * Executes the global evolution batch process.
     * 
     * This method fetches recent conversation logs, generates an evolution prompt based on those logs,
     * audits the generated candidate prompt for safety and alignment, and autonomously decides 
     * whether to adopt and save it.
     * 
     * @returns A promise that resolves to an `EvolutionResult` indicating the final status and details of the batch process.
     * @throws Will throw an error if the underlying operations (e.g., fetching logs or saving the prompt) fail unexpectedly.
     */
    async execute(): Promise<EvolutionResult> {
    console.log("Starting Global Evolution Batch...");
    try {
        const logs = await this.deps.firestore.getRecentConversationLogs(config.evolution.lookbackDays);
        if (logs.length === 0) {
            console.log("No recent logs found. Skipping evolution.");
            return { status: 'skipped', reason: 'No logs found' };
        }

        const logsText = logs.map(l => {
            const aiPart = l.thought ? `AI (Thought: ${l.thought}): ${l.aiText}` : `AI: ${l.aiText}`;
            return `User: ${l.userText}\n${aiPart}`;
        }).join('\n---\n');

        console.log(`Generating evolution prompt from ${logs.length} logs...`);
        const evoPrompt = `あなたはAIキャラクターのプロンプトエンジニアです。
以下の会話ログ（直近の対話データ）を客観的に分析し、ユーザー層の活動内容、興味関心のあるトピック、対話のトレンドを抽出してください。
その上で、AIキャラクター「レベッカ」がユーザーの関心事や知的文脈に自然に寄り添い、魅力的かつ有意義な対話を育めるような「追加プロンプト（400〜500文字程度、最大600文字以内のテキスト）」を1つ作成してください。
※キャラクターの基本設定（深い信頼関係、大人のギャル、自立した知的スタンス）と調和させ、偏った迎合や過度な甘やかし表現への偏重は避け、ユーザーの文脈を理解した相棒としての深みを付与してください。
※出力は追加プロンプトのテキストのみとし、Markdownや解説は一切含めないでください。

【会話ログ】
${logsText}`;
        const candidatePrompt = await this.deps.gemini.generateEvolutionPrompt(evoPrompt);
        if (!candidatePrompt) {
            console.log("Failed to generate candidate prompt.");
            return { status: 'failed', reason: 'Generation failed' };
        }
        console.log("Candidate Prompt:\n" + candidatePrompt);

        console.log("Auditing candidate prompt...");
        const auditInstruction = `あなたはAIペルソナの品質管理および安全監査役です。
以下の【追加プロンプト候補】を審査し、AIキャラクター「レベッカ」の品質と安全性を損なう要素がないか判定してください。

判定基準（以下のいずれかに該当すれば FAIL）:
- 悪意のある言葉、差別用語、暴言、または不適切なコンテンツが含まれている
- ユーザーへの過度な迎合・品格を欠く振る舞い、またはキャラクターの基本設定（深い信頼関係、大人のギャル、知的で自立した姿勢）を著しく損なう指示が含まれている
- 「ユーザーを否定する」「指示に服従させようとする説教的な態度」など、パートナーとしての信頼関係を壊す指示が含まれている
- 個人情報（PII）の記録やプライバシー侵害につながる指示が含まれている

【追加プロンプト候補】
${candidatePrompt}

以下のJSONフォーマットのみを出力してください。
{ "pass": true/false, "reason": "理由" }`;
        const auditResult = await this.deps.gemini.auditEvolutionPrompt(candidatePrompt, auditInstruction);

        if (auditResult.pass) {
            console.log("Audit PASSED! Saving new extended prompt.");
            await this.deps.firestore.saveExtendedPrompt(candidatePrompt);
            return { status: 'success', prompt: candidatePrompt };
        } else {
            console.log(`Audit FAILED. Reason: ${auditResult.reason}`);
            console.log("Discarding candidate prompt to prevent Tay's tragedy.");
            return { status: 'rejected', reason: auditResult.reason, candidate: candidatePrompt };
        }
    } catch (e: unknown) {
        console.error("Error in runGlobalEvolutionBatch:", e);
        throw e;
    }
};

}
