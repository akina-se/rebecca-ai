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
        delete process.env.JUDGE_MODEL;
        delete process.env.GEMINI_LANGUAGE_MODEL;
        delete process.env.RAG_MAX_MEMORIES;
        delete process.env.GLOBAL_DAILY_LIMIT;
        delete process.env.SPAM_MINUTE_LIMIT;
        delete process.env.PUBLIC_IP_RATE_LIMIT;
        delete process.env.EVOLUTION_LOOKBACK_DAYS;
        delete process.env.BATCH_SECRET_KEY;
        delete process.env.X_TARGET_LIST_ID;
        delete process.env.X_FOLLOWERS_PAGE_SIZE;
        delete process.env.X_FOLLOWERS_MAX_RESULTS;
        delete process.env.RANDOM_ENGAGEMENT_COOLDOWN_DAYS;
        delete process.env.IMAGE_COOLDOWN_DAYS;

        const config = require('../../src/config/index').default;

        expect(String(config.port)).toBe('8080');
        expect(config.gcp.location).toBe('asia-northeast1');
        expect(config.gcp.queueName).toBe('rebecca-reply-queue');
        expect(config.gemini.model).toBe('gemini-3.5-flash-lite');
        expect(config.gemini.embeddingModel).toBe('gemini-embedding-2');
        expect(config.gemini.judgeModel).toBe('gemini-3.1-flash-lite');
        expect(config.gemini.languageModel).toBe('gemini-3.1-flash-lite');
        expect(Number(config.rag.maxMemories)).toBe(100);
        expect(Number(config.limits.globalDailyLimit)).toBe(500);
        expect(Number(config.limits.spamMinuteLimit)).toBe(3);
        expect(Number(config.limits.publicIpRateLimit)).toBe(1500);
        expect(Number(config.evolution.lookbackDays)).toBe(7);
        expect(config.xApi.targetListId).toBeUndefined();
        expect(Number(config.xApi.followersPageSize)).toBe(20);
        expect(Number(config.xApi.followersMaxResults)).toBe(1000);
        expect(Number(config.engagement.cooldownDays)).toBe(365);
        expect(Number(config.images.cooldownDays)).toBe(14);
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
        process.env.X_TARGET_LIST_ID = '  list_999  ';
        process.env.X_FOLLOWERS_PAGE_SIZE = '1000';
        process.env.X_FOLLOWERS_MAX_RESULTS = '500';
        process.env.RANDOM_ENGAGEMENT_COOLDOWN_DAYS = '90';
        process.env.IMAGE_COOLDOWN_DAYS = '21';

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
        expect(config.xApi.targetListId).toBe('list_999');
        expect(Number(config.xApi.followersPageSize)).toBe(1000);
        expect(Number(config.xApi.followersMaxResults)).toBe(500);
        expect(Number(config.engagement.cooldownDays)).toBe(90);
        expect(Number(config.images.cooldownDays)).toBe(21);

        const origNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const prodConfig = require('../../src/config/index').default;
        expect(prodConfig.batchSecret).toBeUndefined();
        process.env.NODE_ENV = origNodeEnv;
    });

    it('should clamp bounded integers and treat blank X_TARGET_LIST_ID as undefined', () => {
        process.env.X_TARGET_LIST_ID = '   ';
        process.env.X_FOLLOWERS_PAGE_SIZE = '1';
        process.env.X_FOLLOWERS_MAX_RESULTS = '99999';
        process.env.RANDOM_ENGAGEMENT_COOLDOWN_DAYS = 'not-a-number';

        const config = require('../../src/config/index').default;

        expect(config.xApi.targetListId).toBeUndefined();
        expect(config.xApi.followersPageSize).toBe(5);
        expect(config.xApi.followersMaxResults).toBe(2000);
        expect(config.engagement.cooldownDays).toBe(365);
    });
});
