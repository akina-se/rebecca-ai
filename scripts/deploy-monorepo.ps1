# ==============================================================================
# Script: deploy-monorepo.ps1
# Description: Production Deployment Orchestrator for Rebecca AI Monorepo (Windows PowerShell)
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
#   .\scripts\deploy-monorepo.ps1 [-ProjectId "rebecca-ai-gal"] [-Region "asia-northeast1"]
# ==============================================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "rebecca-ai-gal",

    [Parameter(Mandatory=$false)]
    [string]$Region = "asia-northeast1"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   REBECCA AI - MONOREPO PRODUCTION DEPLOYMENT (PowerShell) " -ForegroundColor Cyan
Write-Host "   Target GCP Project : $ProjectId                         " -ForegroundColor Cyan
Write-Host "   Deployment Region  : $Region                            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Monorepo Compilation
Write-Host "`n🚀 [1/5] Building all monorepo packages (Turborepo)..." -ForegroundColor Cyan
npm run build

# Step 2: Bot Backend Container Build & Push
Write-Host "`n🐳 [2/5] Building and pushing bot-backend container to Artifact Registry..." -ForegroundColor Cyan
$BotImage = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/bot-backend:latest"
docker build -t $BotImage -f apps/bot-backend/Dockerfile .
docker push $BotImage

# Step 3: Cloud Run Deployment - Bot Backend
Write-Host "`n🚀 [3/5] Deploying bot-backend to Cloud Run (rebecca-ai-gal)..." -ForegroundColor Cyan
$env:CLOUDSDK_METRICS_ENVIRONMENT = "datacloud.antigravity"
gcloud run services update rebecca-ai-gal `
    --platform=managed `
    --image=$BotImage `
    --region=$Region `
    --quiet

# Step 4: Dashboard BFF Container Build & Push
Write-Host "`n🐳 [4/5] Building and pushing dashboard-backend container to Artifact Registry..." -ForegroundColor Cyan
$BffImage = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/dashboard-backend:latest"
docker build -t $BffImage -f apps/dashboard-backend/Dockerfile .
docker push $BffImage

# Step 5: Cloud Run Deployment - Dashboard BFF
Write-Host "`n🚀 [4/5] Deploying dashboard-backend to Cloud Run (rebecca-dashboard-bff)..." -ForegroundColor Cyan
gcloud run deploy rebecca-dashboard-bff `
    --platform=managed `
    --image=$BffImage `
    --region=$Region `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$ProjectId,GCP_LOCATION=$Region,PUBLIC_SITE_URL=https://rebecca-ai.net" `
    --quiet

# Step 6: Firebase Hosting & Functions Deployment
Write-Host "`n🔥 [5/6] Deploying Firebase Hosting and Cloud Functions..." -ForegroundColor Cyan
npx -y firebase-tools deploy --only hosting,functions --project $ProjectId

# Step 7: Cloud Scheduler Jobs Synchronization
Write-Host "`n⏰ [6/6] Cloud Scheduler synchronization guide..." -ForegroundColor Cyan
Write-Host "To update Cloud Scheduler jobs for bot-backend batches, run:" -ForegroundColor Yellow
Write-Host "  npm run setup:scheduler" -ForegroundColor Yellow

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "🎉 Monorepo deployment completed successfully!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
