const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config();

const projectId = process.env.GCP_PROJECT_ID;
const region = process.env.GCP_LOCATION || 'asia-northeast1';
const serviceName = 'rebecca-ai-gal';

if (!projectId) {
    console.error('Error: GCP_PROJECT_ID is not set in .env');
    process.exit(1);
}

console.log(`Deploying to GCP Project: ${projectId}, Region: ${region}`);

try {
    // Basic gcloud deploy command for Cloud Run
    const cmd = `gcloud run deploy ${serviceName} --source . --region ${region} --project ${projectId} --allow-unauthenticated`;
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log('Deployment successful!');
} catch (error) {
    console.error('Deployment failed. Make sure gcloud is installed and authenticated.');
    process.exit(1);
}
