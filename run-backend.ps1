$ErrorActionPreference = 'Continue'
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199"
$env:GCP_PROJECT_ID = "rebecca-ai-gal-local"
$env:GCLOUD_PROJECT = "rebecca-ai-gal-local"
$env:PORT = "8081"

# Run seed
npx ts-node -T apps/dashboard-backend/src/scripts/seed-db.ts

# Start BFF
npm run dev --workspace=dashboard-backend
