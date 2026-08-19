#!/usr/bin/env bash
# ==============================================================================
# Bash Helper: Monorepo Manual Deployment for Rebecca AI (macOS / Linux)
# ==============================================================================
# Usage:
#   ./scripts/deploy-monorepo.sh [PROJECT_ID] [REGION]
#   ./scripts/deploy-monorepo.sh rebecca-ai-gal asia-northeast1
# ==============================================================================

set -euo pipefail

PROJECT_ID="${1:-rebecca-ai-gal}"
REGION="${2:-asia-northeast1}"

export CLOUDSDK_METRICS_ENVIRONMENT="datacloud.antigravity"

echo -e "\033[0;36m==========================================================\033[0m"
echo -e "\033[0;36m   REBECCA AI - MONOREPO PRODUCTION DEPLOYMENT            \033[0m"
echo -e "\033[0;36m   Project: ${PROJECT_ID} | Region: ${REGION}             \033[0m"
echo -e "\033[0;36m==========================================================\033[0m"

echo -e "\n\033[0;36m🚀 [1/5] Building all monorepo packages...\033[0m"
npm run build

echo -e "\n\033[0;36m🐳 [2/5] Building and pushing bot-backend container...\033[0m"
BOT_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/bot-backend:latest"
docker build -t "${BOT_IMAGE}" -f apps/bot-backend/Dockerfile .
docker push "${BOT_IMAGE}"

echo -e "\n\033[0;36m🚀 [3/5] Deploying bot-backend to Cloud Run (rebecca-ai-gal)...\033[0m"
gcloud run services update rebecca-ai-gal \
    --platform=managed \
    --image="${BOT_IMAGE}" \
    --region="${REGION}" \
    --quiet

echo -e "\n\033[0;36m🐳 [4/5] Building and pushing dashboard-backend container...\033[0m"
BFF_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/dashboard-backend:latest"
docker build -t "${BFF_IMAGE}" -f apps/dashboard-backend/Dockerfile .
docker push "${BFF_IMAGE}"

echo -e "\n\033[0;36m🚀 [4/5] Deploying dashboard-backend to Cloud Run (rebecca-dashboard-bff)...\033[0m"
gcloud run deploy rebecca-dashboard-bff \
    --platform=managed \
    --image="${BFF_IMAGE}" \
    --region="${REGION}" \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},PUBLIC_SITE_URL=https://rebecca-ai.net" \
    --quiet

echo -e "\n\033[0;36m🔥 [5/5] Deploying Firebase Hosting and Cloud Functions...\033[0m"
npx -y firebase-tools deploy --only hosting,functions --project "${PROJECT_ID}"

echo -e "\n\033[0;32m==========================================================\033[0m"
echo -e "\033[0;32m🎉 Monorepo deployment completed successfully!            \033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
