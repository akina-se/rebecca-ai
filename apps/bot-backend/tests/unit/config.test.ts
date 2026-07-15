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
        delete process.env.SPAM_MINUTE_LIMIT;
        delete process.env.PUBLIC_IP_RATE_LIMIT;
        delete process.env.EVOLUTION_LOOKBACK_DAYS;
        delete process.env.BATCH_SECRET_KEY;
        delete process.env.X_FOLLOWERS_MAX_RESULTS;

        const config = require('../../src/config/index').default;

        expect(String(config.port)).toBe('8080');
        expect(config.gcp.location).toBe('asia-northeast1');
        expect(config.gcp.queueName).toBe('rebecca-reply-queue');
        expect(config.gemini.model).toBe('gemini-3.1-flash-lite');
        expect(config.gemini.embeddingModel).toBe('gemini-embedding-2');
        expect(config.gemini.judgeModel).toBe('gemma-4-31b-it');
        expect(config.gemini.languageModel).toBe('gemma-4-31b-it');
        expect(Number(config.rag.maxMemories)).toBe(100);
        expect(Number(config.limits.globalDailyLimit)).toBe(500);
        expect(Number(config.limits.spamMinuteLimit)).toBe(3);
        expect(Number(config.limits.publicIpRateLimit)).toBe(100);
        expect(Number(config.evolution.lookbackDays)).toBe(7);
        expect(Number(config.xApi.followersMaxResults)).toBe(1000);
        expect(config.batchSecret).toBeUndefined();
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
        process.env.SPAM_MINUTE_LIMIT = '1';
        process.env.PUBLIC_IP_RATE_LIMIT = '50';
        process.env.EVOLUTION_LOOKBACK_DAYS = '14';
        process.env.BATCH_SECRET_KEY = 'secret';
        process.env.X_FOLLOWERS_MAX_RESULTS = '500';

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
        expect(Number(config.limits.spamMinuteLimit)).toBe(1);
        expect(Number(config.limits.publicIpRateLimit)).toBe(50);
        expect(Number(config.evolution.lookbackDays)).toBe(14);
        expect(config.batchSecret).toBe('secret');
        expect(Number(config.xApi.followersMaxResults)).toBe(500);
    });
});
