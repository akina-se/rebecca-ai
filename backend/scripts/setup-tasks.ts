import { execFileSync } from 'child_process';
import 'dotenv/config';

const projectId = process.env.GCP_PROJECT_ID;
const region = process.env.GCP_LOCATION || 'asia-northeast1';
const queueName = process.env.GCP_TASK_QUEUE_NAME;

if (!projectId || !queueName) {
    console.error('Error: GCP_PROJECT_ID or GCP_TASK_QUEUE_NAME is not set in .env');
    process.exit(1);
}

console.log(`Setting up Cloud Tasks queue ${queueName} for ${projectId} in ${region}...`);

try {
    const args = [
        'tasks', 'queues', 'create', queueName,
        '--location', region,
        '--project', projectId
    ];

    execFileSync('gcloud', args, { stdio: 'inherit', shell: true });
    console.log(`✅ Successfully created queue ${queueName}`);
} catch (e) {
    console.log(`Queue ${queueName} might already exist or creation failed.`);
    // We could attempt an update, but for basic queues this is usually sufficient.
}

console.log('Finished setting up Cloud Tasks queue.');
