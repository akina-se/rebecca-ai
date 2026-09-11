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

const jobs = [
    {
        name: 'rebecca-mentions-polling',
        schedule: '0 3,7-23 * * *', // 7:00-23:00 every hour + 3:00 AM JST (18 times/day)
        url: `${serviceUrl}/batch/mentions`
    },
    {
        name: 'rebecca-stealth-onboarding',
        schedule: '15 3,9,15,21 * * *', // 3:15, 9:15, 15:15, 21:15 JST (4 times/day)
        url: `${serviceUrl}/batch/stealth-onboarding`
    },
    {
        name: 'rebecca-dreaming-batch',
        schedule: '0 4 * * *', // Daily at 4:00 AM JST
        url: `${serviceUrl}/batch/dreaming`
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
        schedule: '0 15,18 * * *', // 15:00, 18:00 JST (2 times/day afternoon break & evening commute)
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
    }
];

const createJob = (job: { name: string; schedule: string; url: string }) => {
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
