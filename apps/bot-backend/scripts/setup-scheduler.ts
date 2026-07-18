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

const jobs = [
    {
        name: 'rebecca-mentions-polling',
        schedule: '0 * * * *', // Every hour (at minute 0)
        url: `${serviceUrl}/batch/mentions`
    },
    {
        name: 'rebecca-stealth-onboarding',
        schedule: '15 * * * *', // Every hour (at minute 15)
        url: `${serviceUrl}/batch/stealth-onboarding`
    },
    {
        name: 'rebecca-random-engagement',
        schedule: '0 */2 * * *', // Every 2 hours
        url: `${serviceUrl}/batch/random-engagement`
    },
    {
        name: 'rebecca-dreaming-batch',
        schedule: '0 * * * *', // Every hour (at minute 0)
        url: `${serviceUrl}/batch/dreaming`
    },
    {
        name: 'rebecca-evolution-batch',
        schedule: '0 5 * * *', // Every day at 05:00 UTC
        url: `${serviceUrl}/batch/evolution`
    },
    {
        name: 'rebecca-news-batch',
        schedule: '0 */6 * * *', // Every 6 hours
        url: `${serviceUrl}/batch/news-post`
    }
];

const createJob = (job: { name: string; schedule: string; url: string }) => {
    try {
        const args = [
            'scheduler', 'jobs', 'create', 'http', job.name,
            '--schedule', `"${job.schedule}"`,
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

        console.log(`Creating job: ${job.name} -> ${job.schedule}`);
        execFileSync('gcloud', args, { stdio: 'inherit', shell: true });
        console.log(`✅ Successfully created ${job.name}`);
    } catch (err) {
        // If it already exists, update it instead
        try {
            console.log(`Job ${job.name} might already exist. Attempting to update...`, err);
            const updateArgs = [
                'scheduler', 'jobs', 'update', 'http', job.name,
                '--schedule', `"${job.schedule}"`,
                '--uri', job.url,
                '--location', region,
                '--project', projectId
            ];
            
            if (serviceAccount) {
                updateArgs.push('--oidc-service-account-email', serviceAccount);
                updateArgs.push('--oidc-token-audience', serviceUrl);
            } else if (batchSecret) {
                updateArgs.push('--headers', `X-Batch-Secret=${batchSecret}`);
            }

            execFileSync('gcloud', updateArgs, { stdio: 'inherit', shell: true });
            console.log(`✅ Successfully updated ${job.name}`);
        } catch (updateError) {
            console.error(`❌ Failed to create or update job ${job.name}.`, updateError);
        }
    }
};

jobs.forEach(createJob);
console.log('Finished setting up Cloud Scheduler jobs.');
