#!/usr/bin/env bash
# ==============================================================================
# start-local-env.sh
#
# Startup script for Rebecca AI local developer manual testing environment (macOS / Linux).
# Sets up portable Java 21, Firebase Emulators, runs database seeding, and launches all microservices.
# ==============================================================================

set -euo pipefail

echo -e "\033[0;36m==========================================================\033[0m"
echo -e "\033[0;36m   REBECCA AI - LOCAL DEVELOPER ENVIRONMENT STARTUP       \033[0m"
echo -e "\033[0;36m==========================================================\033[0m"

# 0. Preflight: Clean up orphaned processes on local environment ports
echo -e "\033[0;33m[0/7] Performing preflight port and process check...\033[0m"
TARGET_PORTS=(8080 9099 9199 4000 5001 8081 50051 4200)
KILLED_ANY=false

for PORT in "${TARGET_PORTS[@]}"; do
    if command -v lsof &> /dev/null; then
        PIDS=$(lsof -ti :"${PORT}" 2>/dev/null || true)
        if [ -n "${PIDS}" ]; then
            echo -e "\033[0;90m   -> Port ${PORT} held by PID(s): ${PIDS}. Terminating...\033[0m"
            echo "${PIDS}" | xargs kill -9 2>/dev/null || true
            KILLED_ANY=true
        fi
    elif command -v fuser &> /dev/null; then
        fuser -k "${PORT}/tcp" 2>/dev/null || true
    fi
done

if [ "$KILLED_ANY" = true ]; then
    sleep 1
    echo -e "\033[0;32m-> Lingering processes cleared successfully.\033[0m"
else
    echo -e "\033[0;32m-> Ports are clean.\033[0m"
fi

# 1. Setup local portable JDK 21 to support Firebase Emulators without system install
echo -e "\033[0;33m[1/7] Ensuring local JDK 21 is available...\033[0m"
OS=$(uname -s)
ARCH=$(uname -m)

JDK_URL=""
if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_mac_hotspot_21.0.3_9.tar.gz"
    elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
        JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.3_9.tar.gz"
    fi
elif [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.3_9.tar.gz"
    elif [ "$ARCH" = "aarch64" ]; then
        JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_aarch64_linux_hotspot_21.0.3_9.tar.gz"
    fi
fi

LOCAL_JDK_DIR="$PWD/.jdk"
JDK_VERSION_DIR="$LOCAL_JDK_DIR/jdk-21.0.3+9"
if [ "$OS" = "Darwin" ]; then
    JAVA_EXE="$JDK_VERSION_DIR/Contents/Home/bin/java"
else
    JAVA_EXE="$JDK_VERSION_DIR/bin/java"
fi

if [ ! -f "$JAVA_EXE" ]; then
    if [ -z "$JDK_URL" ]; then
        echo -e "\033[0;31m[ERROR] Unsupported OS or Architecture ($OS $ARCH). Please install JDK 21 manually.\033[0m"
        exit 1
    fi
    echo -e "\033[0;36mLocal JDK 21 not found. Downloading portable Eclipse Temurin JDK 21...\033[0m"
    mkdir -p "$LOCAL_JDK_DIR"
    TAR_FILE="$PWD/.jdk_temp.tar.gz"
    
    echo -e "\033[0;90mDownloading JDK 21 from $JDK_URL...\033[0m"
    if ! curl -L -o "$TAR_FILE" "$JDK_URL"; then
        echo -e "\033[0;31m[ERROR] Failed to download JDK 21.\033[0m"
        exit 1
    fi
    
    echo -e "\033[0;90mExtracting JDK 21 archive...\033[0m"
    if ! tar -xzf "$TAR_FILE" -C "$LOCAL_JDK_DIR"; then
        echo -e "\033[0;31m[ERROR] Failed to extract JDK 21.\033[0m"
        rm -f "$TAR_FILE"
        exit 1
    fi
    rm -f "$TAR_FILE"
    
    # macOS Specific: Remove quarantine attribute
    if [ "$OS" = "Darwin" ]; then
        xattr -r -d com.apple.quarantine "$LOCAL_JDK_DIR" > /dev/null 2>&1 || true
    fi
    
    echo -e "\033[0;32mLocal JDK 21 installed successfully!\033[0m"
else
    echo -e "\033[0;32m-> Local JDK 21 is already installed at $JDK_VERSION_DIR\033[0m"
fi

if [ "$OS" = "Darwin" ]; then
    export JAVA_HOME="$JDK_VERSION_DIR/Contents/Home"
else
    export JAVA_HOME="$JDK_VERSION_DIR"
fi
export PATH="$JAVA_HOME/bin:$PATH"

java -version

# 2. Check for firebase-tools
echo -e "\033[0;33m[2/7] Checking for firebase-tools...\033[0m"
if ! command -v firebase &> /dev/null && [ ! -f "node_modules/.bin/firebase" ]; then
    echo -e "\033[0;90mfirebase CLI not found. Running local check via npx...\033[0m"
fi

# 3. Start Firebase Emulators
echo -e "\033[0;33m[3/7] Starting Firebase Emulators...\033[0m"
mkdir -p .logs
npx -y firebase-tools emulators:start --only auth,firestore,storage,functions --project rebecca-ai-gal-local > .logs/firebase-emulators.log 2>&1 &
echo -e "\033[0;90m-> Firebase Emulators launching in background (logs in .logs/firebase-emulators.log)...\033[0m"

# 4. Wait for emulators to bind
echo -e "\033[0;33m[4/7] Waiting for Firestore Emulator (port 8080), Auth (port 9099) & Storage (port 9199) to bind...\033[0m"
RETRIES=0
MAX_RETRIES=60
READY=false

test_port() {
    local PORT=$1
    if command -v nc &> /dev/null; then
        nc -z 127.0.0.1 "$PORT" 2>/dev/null
    else
        (echo > "/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
    fi
}

while [ $RETRIES -lt $MAX_RETRIES ] && [ "$READY" = false ]; do
    sleep 1
    if test_port 8080 && test_port 9099 && test_port 9199; then
        READY=true
    else
        RETRIES=$((RETRIES+1))
        echo -e "\033[0;90m   Waiting... ($RETRIES/$MAX_RETRIES s)\033[0m"
    fi
done

if [ "$READY" = false ]; then
    echo -e "\033[0;31m[ERROR] Firebase Emulators failed to start or bind within time limit ($MAX_RETRIES s).\033[0m"
    exit 1
fi
echo -e "\033[0;32m-> Firebase Emulators are ready!\033[0m"

# 5. Run seed script
echo -e "\033[0;33m[5/7] Seeding Local Auth & Firestore Emulators...\033[0m"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
export FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:9199"
export GCLOUD_PROJECT="rebecca-ai-gal-local"

if npx ts-node -T apps/dashboard-backend/src/scripts/seed-db.ts; then
    echo -e "\033[0;32m-> Database seeded successfully with mock timeline posts, active/blocked users, and KPI metrics!\033[0m"
else
    echo -e "\033[0;33m[WARNING] Seeding script completed with warnings or errors.\033[0m"
fi

# 6. Start Bot Backend (gRPC Server)
echo -e "\033[0;33m[6/7] Starting Bot Backend (gRPC Server)...\033[0m"
export GCP_PROJECT_ID="rebecca-ai-gal-local"
npm run dev --workspace=bot-backend > .logs/bot-backend.log 2>&1 &
echo -e "\033[0;90m-> Bot Backend launched (gRPC port 50051, logs in .logs/bot-backend.log)...\033[0m"

# 7. Start Dashboard Backend (BFF Server)
echo -e "\033[0;33m[7/7] Starting Dashboard Backend (BFF Server)...\033[0m"
export BOT_GRPC_URL="localhost:50051"
export PORT="8081"
npm run dev --workspace=dashboard-backend > .logs/dashboard-backend.log 2>&1 &
echo -e "\033[0;90m-> Dashboard BFF launched (HTTP port 8081, logs in .logs/dashboard-backend.log)...\033[0m"

# 8. Start Dashboard Frontend (Angular Dev Server)
echo -e "\033[0;33mStarting Dashboard Frontend (Angular Dev Server)...\033[0m"
npm run dev --workspace=dashboard-frontend > .logs/dashboard-frontend.log 2>&1 &
echo -e "\033[0;90m-> Dashboard Frontend launching (HTTP port 4200, logs in .logs/dashboard-frontend.log)...\033[0m"

echo -e "\n\033[0;32m==========================================================\033[0m"
echo -e "\033[0;32m   ALL SERVICES STARTED SUCCESSFULLY IN BACKGROUND!       \033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
echo -e "\033[1;37m   Access URLs:\033[0m"
echo -e "\033[0;36m   - Admin Dashboard UI:   http://localhost:4200/\033[0m"
echo -e "\033[0;36m   - Firebase Emulator UI: http://127.0.0.1:4000/\033[0m"
echo -e "\033[0;90m     * Auth Emulator:      http://127.0.0.1:4000/auth\033[0m"
echo -e "\033[0;90m     * Firestore Emulator: http://127.0.0.1:4000/firestore\033[0m"
echo -e "\033[0;36m   - BFF Backend Health:   http://localhost:8081/health\033[0m"
echo -e "\033[0;36m   - Bot Backend gRPC:     localhost:50051\033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
echo -e "\033[1;37m   Sign-in Credentials:\033[0m"
echo -e "\033[0;35m   - Email:    admin@example.com\033[0m"
echo -e "\033[0;35m   - Password: password123\033[0m"
echo -e "\033[0;90m   (Or click 'Sign in with Google' and use any dummy account)\033[0m"
echo -e "\033[0;32m==========================================================\033[0m"
echo -e "\033[0;33mTo stop all background services, run: killall node java\033[0m"
