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

console.log(`Setting up Cloud Scheduler jobs for ${projectId} in ${region}...`);

const timeZone = process.env.APP_TIMEZONE || 'Asia/Tokyo';

interface SchedulerJobConfig {
    name: string;
    schedule: string;
    url: string;
    attemptDeadline?: string;
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

const createJob = (job: SchedulerJobConfig) => {
    try {
        const args = [
            'scheduler', 'jobs', 'create', 'http', job.name,
            '--schedule', `"${job.schedule}"`,
            '--time-zone', timeZone,
            '--uri', job.url,
            '--http-method', 'GET',
            '--location', region,
            '--project', projectId
        ];

        if (job.attemptDeadline) {
            args.push('--attempt-deadline', job.attemptDeadline);
        }

        // Use OIDC if service account is provided, otherwise fallback to shared secret
        if (serviceAccount) {
            args.push('--oidc-service-account-email', serviceAccount);
            args.push('--oidc-token-audience', serviceUrl);
            console.log(`Using OIDC authentication for ${job.name}`);
        } else if (batchSecret) {
            args.push('--headers', `X-Batch-Secret=${batchSecret}`);
            console.log(`Using Shared Secret authentication for ${job.name}`);
        } else {
            console.warn(`WARNING: No authentication configured for ${job.name}. Add SERVICE_ACCOUNT_EMAIL or BATCH_SECRET_KEY to .env`);
        }

        console.log(`Creating job: ${job.name} -> ${job.schedule} (${timeZone})`);
        execFileSync('gcloud', args, { stdio: 'inherit', shell: true });
        console.log(`✅ Successfully created ${job.name}`);
    } catch {
        // If it already exists, update it instead
        try {
            console.log(`Job ${job.name} might already exist. Attempting to update...`);
            const updateArgs = [
                'scheduler', 'jobs', 'update', 'http', job.name,
                '--schedule', `"${job.schedule}"`,
                '--time-zone', timeZone,
                '--uri', job.url,
                '--location', region,
                '--project', projectId
            ];

            if (job.attemptDeadline) {
                updateArgs.push('--attempt-deadline', job.attemptDeadline);
            }

            if (serviceAccount) {
                updateArgs.push('--oidc-service-account-email', serviceAccount);
                updateArgs.push('--oidc-token-audience', serviceUrl);
            } else if (batchSecret) {
                updateArgs.push('--update-headers', `X-Batch-Secret=${batchSecret}`);
            }

            execFileSync('gcloud', updateArgs, { stdio: 'inherit', shell: true });
            console.log(`✅ Successfully updated ${job.name}`);
        } catch {
            console.error(`❌ Failed to create or update job ${job.name}.`);
        }
    }
};

jobs.forEach(createJob);
console.log('Finished setting up Cloud Scheduler jobs.');
