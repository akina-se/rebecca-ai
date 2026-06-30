jest.mock('dotenv/config', () => ({}));
describe('Config', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('should use default values when env vars are missing', () => {
        delete process.env.PORT;
        delete process.env.GCP_LOCATION;
        delete process.env.GCP_TASK_QUEUE_NAME;
        delete process.env.GEMINI_MODEL;
        delete process.env.GEMINI_EMBEDDING_MODEL;
        delete process.env.GEMINI_JUDGE_MODEL;
        delete process.env.GEMINI_LANGUAGE_MODEL;
        delete process.env.RAG_MAX_MEMORIES;
        delete process.env.GLOBAL_DAILY_LIMIT;
        delete process.env.GLOBAL_MINUTE_LIMIT;
        delete process.env.SPAM_MINUTE_LIMIT;
        delete process.env.POLLING_INTERVAL_MINUTES;

        const config = require('../../src/config/index').default;

        expect(String(config.port)).toBe('8080');
        expect(config.gcp.location).toBe('asia-northeast1');
        expect(config.gcp.queueName).toBe('rebecca-reply-queue');
        expect(config.gemini.model).toBe('gemini-2.5-flash');
        expect(config.gemini.embeddingModel).toBe('text-embedding-004');
        expect(config.gemini.judgeModel).toBe('gemma-4-31b-it');
        expect(config.gemini.languageModel).toBe('gemma-4-31b-it');
        expect(Number(config.rag.maxMemories)).toBe(100);
        expect(Number(config.limits.globalDailyLimit)).toBe(45);
        expect(Number(config.limits.globalMinuteLimit)).toBe(5);
        expect(Number(config.limits.spamMinuteLimit)).toBe(3);
        expect(Number(config.pollingIntervalMinutes)).toBe(0);
    });

    it('should use env vars when provided', () => {
        process.env.PORT = '9090';
        process.env.GCP_LOCATION = 'us-central1';
        process.env.GCP_TASK_QUEUE_NAME = 'custom-queue';
        process.env.GEMINI_MODEL = 'custom-model';
        process.env.GEMINI_EMBEDDING_MODEL = 'custom-embed';
        process.env.GEMINI_JUDGE_MODEL = 'custom-judge';
        process.env.GEMINI_LANGUAGE_MODEL = 'custom-lang';
        process.env.RAG_MAX_MEMORIES = '50';
        process.env.GLOBAL_DAILY_LIMIT = '100';
        process.env.GLOBAL_MINUTE_LIMIT = '10';
        process.env.SPAM_MINUTE_LIMIT = '5';
        process.env.POLLING_INTERVAL_MINUTES = '60';

        const config = require('../../src/config/index').default;

        expect(String(config.port)).toBe('9090');
        expect(config.gcp.location).toBe('us-central1');
        expect(config.gcp.queueName).toBe('custom-queue');
        expect(config.gemini.model).toBe('custom-model');
        expect(config.gemini.embeddingModel).toBe('custom-embed');
        expect(config.gemini.judgeModel).toBe('custom-judge');
        expect(config.gemini.languageModel).toBe('custom-lang');
        expect(Number(config.rag.maxMemories)).toBe(50);
        expect(Number(config.limits.globalDailyLimit)).toBe(100);
        expect(Number(config.limits.globalMinuteLimit)).toBe(10);
        expect(Number(config.limits.spamMinuteLimit)).toBe(5);
        expect(Number(config.pollingIntervalMinutes)).toBe(60);
    });
});
