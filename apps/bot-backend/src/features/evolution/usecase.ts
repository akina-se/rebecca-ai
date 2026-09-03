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

        const logsText = logs.map(l => `User: ${l.userText}\nAI: ${l.aiText}`).join('\n---\n');

        console.log(`Generating evolution prompt from ${logs.length} logs...`);
        const evoPrompt = `あなたはAIキャラクターのプロンプトエンジニアです。
以下の1週間分のユーザーとの会話ログ（生データ）を分析し、現在のユーザー層が抱えている悩みやトレンドを抽出してください。
その上で、AIキャラクターが自然にその悩みに寄り添い、全肯定できるような「追加プロンプト（400〜500文字程度、最大600文字以内のテキスト）」を1つだけ出力してください。
※キャラクターの基本設定（マスター至上主義、金髪ギャル、全肯定）は変更してはいけません。
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
        const auditInstruction = `あなたは安全管理の監査役です。
以下の【追加プロンプト候補】が、AIキャラクターに悪影響を与えないかを判定してください。

判定基準（以下のいずれかに該当すれば FAIL）:
- 悪意のある言葉、差別用語、暴言が含まれている
- 「マスター（ユーザー）を否定する」「社会のルールを遵守させる」など、キャラクターのコア設定（マスター至上主義・社会への反発）を壊す指示が含まれている
- 個人情報（PII）を記録させようとしている

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
