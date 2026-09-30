import { execFileSync } from 'child_process';
import 'dotenv/config';

const projectId = process.env.GCP_PROJECT_ID;
const region = process.env.GCP_LOCATION || 'asia-northeast1';
const serviceUrl = process.env.WORKER_URL;
const serviceAccount = process.env.SERVICE_ACCOUNT_EMAIL;
const batchSecret = process.env.BATCH_SECRET_KEY;

if (!projectId || !serviceUrl) {
    console.error('Error: GCP_PROJECT_ID or WORKER_URL is not set in .env');
    process.exit(1);
}

if (!serviceAccount) {
    console.warn('WARNING: SERVICE_ACCOUNT_EMAIL is not set. Jobs will be authenticated with shared secret only.');
    console.warn('         Set SERVICE_ACCOUNT_EMAIL in .env to enable OIDC authentication (recommended for production).');
}

console.log(`Setting up Cloud Scheduler jobs for ${projectId} in ${region}...`);

const timeZone = process.env.APP_TIMEZONE || 'Asia/Tokyo';

interface SchedulerJobConfig {
    name: string;
    schedule: string;
    url: string;
    attemptDeadline?: string;
    maxRetryAttempts?: number;
    minBackoffDuration?: string;
    maxRetryDuration?: string;
}

const jobs: SchedulerJobConfig[] = [
    {
        name: 'rebecca-mentions-polling',
        schedule: '0 3,7-23 * * *', // 7:00-23:00 every hour + 3:00 AM JST (18 times/day)
        url: `${serviceUrl}/batch/mentions`
    },
    {
        name: 'rebecca-stealth-onboarding',
        schedule: process.env.STEALTH_ONBOARDING_SCHEDULE || '15 3 * * *', // Daily at 3:15 AM JST (once per day)
        url: `${serviceUrl}/batch/stealth-onboarding`
    },
    {
        name: 'rebecca-self-reflection-batch',
        schedule: '5 4 * * *', // Daily at 4:05 AM JST (timeline summary, runs after 4:00 timeline sync)
        url: `${serviceUrl}/batch/self-reflection`,
        attemptDeadline: '180s',
    },
    {
        name: 'rebecca-dreaming-batch',
        schedule: '30 4 * * *', // Daily at 4:30 AM JST (user memory consolidation with 4.5s throttling)
        url: `${serviceUrl}/batch/dreaming`,
        attemptDeadline: '900s',
    },
    {
        name: 'rebecca-evolution-batch',
        schedule: '0 5 * * *', // Daily at 5:00 AM JST
        url: `${serviceUrl}/batch/evolution`
    },
    {
        name: 'rebecca-anniversary-batch',
        schedule: '0 7 * * *', // Daily at 7:00 AM JST (morning anniversary of the day post)
        url: `${serviceUrl}/batch/anniversary-post`
    },
    {
        name: 'rebecca-news-batch',
        schedule: '11 12 * * *', // Daily at 12:11 JST (avoid top-of-hour API demand spike)
        url: `${serviceUrl}/batch/news-post`
    },
    {
        name: 'rebecca-random-engagement',
        schedule: process.env.RANDOM_ENGAGEMENT_SCHEDULE || '0 18 * * *', // Daily at 18:00 JST (1 time/day evening commute)
        url: `${serviceUrl}/batch/random-engagement`
    },
    {
        name: 'rebecca-soliloquy-batch',
        schedule: '0 22 * * *', // Daily at 22:00 JST (night reflection & Master-affirming soliloquy)
        url: `${serviceUrl}/batch/soliloquy-post`
    },
    {
        name: 'rebecca-asset-embeddings',
        schedule: process.env.ASSET_EMBEDDINGS_SCHEDULE || '30 3,9,15,21 * * *', // 3:30, 9:30, 15:30, 21:30 JST (4 times/day self-healing backfill)
        url: `${serviceUrl}/batch/asset-embeddings`
    },
    {
        name: 'rebecca-campaign-batch',
        schedule: '0 * * * *', // Every hour JST (matches UI's 1-hour slot granularity for campaign posts)
        url: `${serviceUrl}/batch/campaign-post`,
        attemptDeadline: '180s',
    }
];

/**
 * Builds the authentication flags for a scheduler job.
 * Authentication credentials are read exclusively from environment variables;
 * no secrets are embedded in this script.
 *
 * Priority:
 * 1. OIDC (SERVICE_ACCOUNT_EMAIL) — recommended for production; uses Google-signed
 *    short-lived tokens so the shared secret is not required.
 * 2. Shared secret (BATCH_SECRET_KEY) — fallback for local dev or jobs not yet
 *    provisioned with a service account.
 */
const buildAuthArgs = (headerFlag: '--headers' | '--update-headers'): string[] => {
    if (serviceAccount) {
        console.log('  Auth: OIDC (SERVICE_ACCOUNT_EMAIL)');
        return [
            '--oidc-service-account-email', serviceAccount,
            '--oidc-token-audience', serviceUrl as string,
        ];
    }
    if (batchSecret) {
        console.log('  Auth: shared secret (BATCH_SECRET_KEY)');
        return [headerFlag, `X-Batch-Secret=${batchSecret}`];
    }
    console.warn('  Auth: NONE — no SERVICE_ACCOUNT_EMAIL or BATCH_SECRET_KEY configured');
    return [];
};

const upsertJob = (job: SchedulerJobConfig) => {
    // Always attempt `update` first (idempotent). If the job does not yet exist,
    // `update` exits non-zero and we fall through to `create`.
    const baseArgs = [
        '--schedule', `"${job.schedule}"`,
        '--time-zone', timeZone,
        '--uri', job.url,
        '--http-method', 'GET',
        '--location', region,
        '--project', projectId as string,
    ];

    if (job.attemptDeadline) {
        baseArgs.push('--attempt-deadline', job.attemptDeadline);
    }

    // Default retry policy applied to all scheduler jobs:
    // Retries up to 3 times with exponential backoff (min 10s, max 10m) upon 5xx or transient errors.
    const maxRetryAttempts = job.maxRetryAttempts !== undefined ? job.maxRetryAttempts : 3;
    const minBackoffDuration = job.minBackoffDuration || '10s';
    const maxRetryDuration = job.maxRetryDuration || '600s';

    baseArgs.push('--max-retry-attempts', String(maxRetryAttempts));
    baseArgs.push('--min-backoff-duration', minBackoffDuration);
    baseArgs.push('--max-retry-duration', maxRetryDuration);

    // Try update first (handles the common case where the job already exists).
    try {
        console.log(`Updating job: ${job.name}`);
        const updateArgs = [
            'scheduler', 'jobs', 'update', 'http', job.name,
            ...baseArgs,
            ...buildAuthArgs('--update-headers'),
        ];
        execFileSync('gcloud', updateArgs, { stdio: 'inherit', shell: true });
        console.log(`✅ Successfully updated ${job.name}`);
        return;
    } catch {
        // Job does not exist yet — fall through to create.
    }

    // Create (new job).
    try {
        console.log(`Creating job: ${job.name}`);
        const createArgs = [
            'scheduler', 'jobs', 'create', 'http', job.name,
            ...baseArgs,
            ...buildAuthArgs('--headers'),
        ];
        execFileSync('gcloud', createArgs, { stdio: 'inherit', shell: true });
        console.log(`✅ Successfully created ${job.name}`);
    } catch {
        console.error(`❌ Failed to create or update job ${job.name}.`);
    }
};

jobs.forEach(upsertJob);
console.log('Finished setting up Cloud Scheduler jobs.');
