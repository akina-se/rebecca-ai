$ErrorActionPreference = 'Continue'
$JdkPath = Join-Path $PSScriptRoot ".jdk\jdk-21.0.3+9"
$env:JAVA_HOME = $JdkPath
$env:PATH = "$JdkPath\bin;" + $env:PATH
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199"
$env:GCP_PROJECT_ID = "rebecca-ai-gal-local"
$env:GCLOUD_PROJECT = "rebecca-ai-gal-local"

npx -y firebase-tools emulators:start --only auth,firestore,storage --project rebecca-ai-gal-local
