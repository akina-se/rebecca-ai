import { execFileSync } from 'child_process';
import 'dotenv/config';

const projectId = process.env.GCP_PROJECT_ID;
const region = process.env.GCP_LOCATION || 'asia-northeast1';
const functionsUrl = process.env.FUNCTIONS_URL || (projectId ? `https://${region}-${projectId}.cloudfunctions.net/batchTimelineSync` : undefined);
const serviceAccount = process.env.SERVICE_ACCOUNT_EMAIL;
const batchSecret = process.env.BATCH_SECRET_KEY;
const schedule = process.env.TIMELINE_SYNC_SCHEDULE || '0 4 * * *'; // Default: Daily at 4:00 AM JST
const timeZone = 'Asia/Tokyo';

if (!projectId || !functionsUrl) {
    console.error('Error: GCP_PROJECT_ID is not set in .env');
    process.exit(1);
}

console.log(`Setting up Cloud Scheduler job for Functions (${projectId}) in ${region}...`);

const job = {
    name: 'rebecca-timeline-sync',
    schedule: schedule,
    url: functionsUrl,
};

const createJob = (jobConfig: { name: string; schedule: string; url: string }) => {
    try {
        const args = [
            'scheduler', 'jobs', 'create', 'http', jobConfig.name,
            '--schedule', `"${jobConfig.schedule}"`,
            '--time-zone', timeZone,
            '--uri', jobConfig.url,
            '--http-method', 'GET',
            '--location', region,
            '--project', projectId,
        ];

        if (serviceAccount) {
            args.push('--oidc-service-account-email', serviceAccount);
            args.push('--oidc-token-audience', functionsUrl);
            console.log(`Using OIDC authentication for ${jobConfig.name}`);
        } else if (batchSecret) {
            args.push('--headers', `X-Batch-Secret=${batchSecret}`);
            console.log(`Using Shared Secret authentication for ${jobConfig.name}`);
        } else {
            console.warn(`WARNING: No authentication configured for ${jobConfig.name}. Add SERVICE_ACCOUNT_EMAIL or BATCH_SECRET_KEY to .env`);
        }

        console.log(`Creating job: ${jobConfig.name} -> ${jobConfig.schedule} (${timeZone})`);
        execFileSync('gcloud', args, { stdio: 'inherit', shell: true });
        console.log(`✅ Successfully created ${jobConfig.name}`);
    } catch {
        try {
            console.log(`Job ${jobConfig.name} might already exist. Attempting to update...`);
            const updateArgs = [
                'scheduler', 'jobs', 'update', 'http', jobConfig.name,
                '--schedule', `"${jobConfig.schedule}"`,
                '--time-zone', timeZone,
                '--uri', jobConfig.url,
                '--http-method', 'GET',
                '--location', region,
                '--project', projectId,
            ];

            if (serviceAccount) {
                updateArgs.push('--oidc-service-account-email', serviceAccount);
                updateArgs.push('--oidc-token-audience', functionsUrl);
            } else if (batchSecret) {
                updateArgs.push('--update-headers', `X-Batch-Secret=${batchSecret}`);
            }

            execFileSync('gcloud', updateArgs, { stdio: 'inherit', shell: true });
            console.log(`✅ Successfully updated ${jobConfig.name}`);
        } catch (error) {
            console.error(`❌ Failed to create or update job ${jobConfig.name}.`, error);
        }
    }
};

createJob(job);
console.log('Finished setting up Functions Cloud Scheduler job.');
