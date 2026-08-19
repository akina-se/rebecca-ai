# ==============================================================================
# PowerShell Helper: Monorepo Manual Deployment for Rebecca AI
# ==============================================================================
# Usage:
#   .\scripts\deploy-monorepo.ps1
# ==============================================================================

param (
    [string]$ProjectId = "rebecca-ai-gal",
    [string]$Region = "asia-northeast1"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 [1/5] Building all monorepo packages..." -ForegroundColor Cyan
npm run build

Write-Host "`n🐳 [2/5] Building and pushing bot-backend container..." -ForegroundColor Cyan
$BotImage = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/bot-backend:latest"
docker build -t $BotImage -f apps/bot-backend/Dockerfile .
docker push $BotImage

Write-Host "`n🚀 [3/5] Deploying bot-backend to Cloud Run (rebecca-ai-gal)..." -ForegroundColor Cyan
$env:CLOUDSDK_METRICS_ENVIRONMENT = "datacloud.antigravity"
gcloud run services update rebecca-ai-gal `
    --platform=managed `
    --image=$BotImage `
    --region=$Region `
    --quiet

Write-Host "`n🐳 [4/5] Building and pushing dashboard-backend container..." -ForegroundColor Cyan
$BffImage = "$Region-docker.pkg.dev/$ProjectId/cloud-run-source-deploy/dashboard-backend:latest"
docker build -t $BffImage -f apps/dashboard-backend/Dockerfile .
docker push $BffImage

Write-Host "`n🚀 [4/5] Deploying dashboard-backend to Cloud Run (rebecca-dashboard-bff)..." -ForegroundColor Cyan
gcloud run deploy rebecca-dashboard-bff `
    --platform=managed `
    --image=$BffImage `
    --region=$Region `
    --allow-unauthenticated `
    --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$ProjectId,GCP_LOCATION=$Region,PUBLIC_SITE_URL=https://rebecca-ai.net" `
    --quiet

Write-Host "`n🔥 [5/5] Deploying Firebase Hosting and Cloud Functions..." -ForegroundColor Cyan
npx -y firebase-tools deploy --only hosting,functions --project $ProjectId

Write-Host "`n🎉 Monorepo deployment completed successfully!" -ForegroundColor Green
