#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-monorepo.sh
# Description: Production Deployment Orchestrator for Rebecca AI Monorepo (Linux / macOS)
# ==============================================================================
# Architecture Workflow:
#   1. Builds all shared TypeScript libraries and workspaces using Turborepo.
#   2. Packages and pushes the `bot-backend` Docker container to Google Artifact Registry.
#   3. Deploys the `bot-backend` microservice to Google Cloud Run (`rebecca-ai-gal`).
#   4. Packages and pushes the `dashboard-backend` (BFF) Docker container.
#   5. Deploys the `dashboard-backend` microservice to Google Cloud Run (`rebecca-dashboard-bff`).
#   6. Deploys the static Angular SPA to Firebase Hosting and backend Cloud Functions.
#
# Requirements:
#   - Google Cloud SDK (`gcloud`) authenticated with sufficient IAM roles.
#   - Docker CLI active.
#   - Node.js >= 20 and npm.
#
# Usage:
#   ./scripts/deploy-monorepo.sh [PROJECT_ID] [REGION]
# Example:
#   ./scripts/deploy-monorepo.sh rebecca-ai-gal asia-northeast1
# ==============================================================================

set -euo pipefail

PROJECT_ID="${1:-rebecca-ai-gal}"
REGION="${2:-asia-northeast1}"

export CLOUDSDK_METRICS_ENVIRONMENT="datacloud.antigravity"

echo -e "\033[0;36m==========================================================\033[0m"
echo -e "\033[0;36m   REBECCA AI - MONOREPO PRODUCTION DEPLOYMENT            \033[0m"
echo -e "\033[0;36m   Target GCP Project : ${PROJECT_ID}                     \033[0m"
echo -e "\033[0;36m   Deployment Region  : ${REGION}                         \033[0m"
echo -e "\033[0;36m==========================================================\033[0m"

# Step 1: Monorepo Compilation
echo -e "\n\033[0;36m🚀 [1/5] Building all monorepo packages (Turborepo)...\033[0m"
npm run build

# Step 2: Bot Backend Container Build & Push
echo -e "\n\033[0;36m🐳 [2/5] Building and pushing bot-backend container to Artifact Registry...\033[0m"
BOT_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/bot-backend:latest"
docker build -t "${BOT_IMAGE}" -f apps/bot-backend/Dockerfile .
docker push "${BOT_IMAGE}"

# Step 3: Cloud Run Deployment - Bot Backend
echo -e "\n\033[0;36m🚀 [3/5] Deploying bot-backend to Cloud Run (rebecca-ai-gal)...\033[0m"
gcloud run services update rebecca-ai-gal \
    --platform=managed \
    --image="${BOT_IMAGE}" \
    --region="${REGION}" \
    --quiet

# Step 4: Dashboard BFF Container Build & Push
echo -e "\n\033[0;36m🐳 [4/5] Building and pushing dashboard-backend container to Artifact Registry...\033[0m"
BFF_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/dashboard-backend:latest"
docker build -t "${BFF_IMAGE}" -f apps/dashboard-backend/Dockerfile .
docker push "${BFF_IMAGE}"

# Step 5: Cloud Run Deployment - Dashboard BFF
echo -e "\n\033[0;36m🚀 [4/5] Deploying dashboard-backend to Cloud Run (rebecca-dashboard-bff)...\033[0m"
gcloud run deploy rebecca-dashboard-bff \
    --platform=managed \
    --image="${BFF_IMAGE}" \
    --region="${REGION}" \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},PUBLIC_SITE_URL=https://rebecca-ai.net" \
    --quiet

# Step 6: Firebase Hosting & Functions Deployment
echo -e "\n\033[0;36m🔥 [5/6] Deploying Firebase Hosting and Cloud Functions...\033[0m"
npx -y firebase-tools deploy --only hosting,functions --project "${PROJECT_ID}"

# Step 7: Cloud Scheduler Jobs Synchronization
echo -e "\n\033[0;36m⏰ [6/6] Cloud Scheduler synchronization guide...\033[0m"
echo -e "To update Cloud Scheduler jobs for bot-backend batches, run:"
echo -e "  npm run setup:scheduler"

echo -e "\n\033[0;32m==========================================================\033[0m"
echo -e "\033[0;32m🎉 Monorepo deployment completed successfully!            \033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
