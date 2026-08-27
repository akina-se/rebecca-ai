# start-local-env.ps1
#
# Startup script for Rebecca AI local manual testing environment.
# Sets up portable Java 21, Firebase Emulators, runs database seeding, and launches all microservices.

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   REBECCA AI - LOCAL DEVELOPER ENVIRONMENT STARTUP       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 0. Preflight: Clean up orphaned processes on local environment ports
Write-Host "[0/7] Performing preflight port and process check..." -ForegroundColor Yellow
$TargetPorts = @(8080, 9099, 9199, 4000, 5001, 8081, 50051, 4200)
$KilledAny = $false

foreach ($Port in $TargetPorts) {
    try {
        $Connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($Connections) {
            foreach ($Conn in $Connections) {
                $ProcId = $Conn.OwningProcess
                if ($ProcId -gt 4) {
                    $Proc = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
                    if ($Proc) {
                        Write-Host "   -> Port $Port is currently held by PID $ProcId ($($Proc.ProcessName)). Terminating lingering process..." -ForegroundColor Gray
                        Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
                        $KilledAny = $true
                    }
                }
            }
        }
    } catch {
        # Ignore permission/lookup warnings
    }
}
if ($KilledAny) {
    Start-Sleep -Seconds 1
    Write-Host "-> Lingering processes cleared successfully." -ForegroundColor Green
} else {
    Write-Host "-> Ports are clean." -ForegroundColor Green
}

# 1. Setup local portable JDK 21 to support Firebase Emulators without system install
Write-Host "[1/7] Ensuring local JDK 21 is available..." -ForegroundColor Yellow
$LocalJdkDir = "$PWD\.jdk"
$JdkVersionDir = "$LocalJdkDir\jdk-21.0.3+9"
$JavaExe = "$JdkVersionDir\bin\java.exe"

if (!(Test-Path $JavaExe)) {
    Write-Host "Local JDK 21 not found. Downloading portable Eclipse Temurin JDK 21 (approx. 190MB)..." -ForegroundColor Cyan
    $Url = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jdk_x64_windows_hotspot_21.0.3_9.zip"
    $ZipFile = "$PWD\.jdk_temp.zip"
    
    # Ensure .jdk directory exists
    New-Item -ItemType Directory -Force -Path $LocalJdkDir | Out-Null
    
    # Enable TLS 1.2
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    
    Write-Host "Downloading JDK 21 from $Url..." -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing
    } catch {
        Write-Host "[ERROR] Failed to download JDK 21. Details: $_" -ForegroundColor Red
        Write-Host "Please check your internet connection or install JDK 21 manually." -ForegroundColor Red
        Exit 1
    }
    
    Write-Host "Extracting JDK 21 archive..." -ForegroundColor Gray
    try {
        Expand-Archive -Path $ZipFile -DestinationPath $LocalJdkDir -Force
        Remove-Item $ZipFile -Force
        Write-Host "Local JDK 21 installed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to extract JDK 21. Details: $_" -ForegroundColor Red
        if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
        Exit 1
    }
} else {
    Write-Host "-> Local JDK 21 is already installed at $JdkVersionDir." -ForegroundColor Green
}

# Apply local Java 21 environment variables to this process
$env:JAVA_HOME = $JdkVersionDir
$env:PATH = "$JdkVersionDir\bin;$env:PATH"

# Verify local java version
$VerOutput = & java -version 2>&1
Write-Host "Using Java version:" -ForegroundColor Gray
Write-Host $VerOutput -ForegroundColor Gray

# 2. Check for firebase-tools
Write-Host "[2/7] Checking for firebase-tools..." -ForegroundColor Yellow
if (!(Get-Command firebase -ErrorAction SilentlyContinue) -and !(Test-Path "node_modules/.bin/firebase")) {
    Write-Host "firebase CLI not found. Running local check via npx..." -ForegroundColor Gray
}

# Fast socket connection checker to avoid PowerShell Test-NetConnection ICMP/DNS latency overhead
function Test-PortQuickly ([int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $asyncResult.AsyncWaitHandle.WaitOne(200, $false)
        if ($success -and $tcp.Connected) {
            $tcp.EndConnect($asyncResult)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# 3. Launch Firebase Emulators (Auth, Firestore, Storage)
Write-Host "[3/7] Starting Firebase Emulators..." -ForegroundColor Yellow
$EmulatorCommand = "`$env:JAVA_HOME='$JdkVersionDir'; `$env:PATH='$JdkVersionDir\bin;'+`$env:PATH; npx -y firebase-tools emulators:start --only auth,firestore,storage --project rebecca-ai-gal-local"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $EmulatorCommand -WorkingDirectory $PWD
Write-Host "-> Firebase Emulators launching in a separate terminal window..." -ForegroundColor Gray

# 4. Wait for emulators to be fully ready
Write-Host "[4/7] Waiting for Firestore Emulator (port 8080), Auth (port 9099) & Storage (port 9199) to bind..." -ForegroundColor Yellow
$retries = 0
$maxRetries = 60
$ready = $false
while ($retries -lt $maxRetries -and -not $ready) {
    Start-Sleep -Seconds 1
    $port8080 = Test-PortQuickly -Port 8080
    $port9099 = Test-PortQuickly -Port 9099
    $port9199 = Test-PortQuickly -Port 9199
    if ($port8080 -and $port9099 -and $port9199) {
        $ready = $true
    } else {
        $retries++
        Write-Host "   Waiting... ($retries/$maxRetries s)" -ForegroundColor Gray
    }
}

if (-not $ready) {
    Write-Host "[ERROR] Firebase Emulators failed to start or bind within time limit ($maxRetries s)." -ForegroundColor Red
    Exit 1
}
Write-Host "-> Firebase Emulators are ready!" -ForegroundColor Green

# 5. Run the seed script to populate Auth and Firestore
Write-Host "[5/7] Seeding Local Auth & Firestore Emulators..." -ForegroundColor Yellow
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199"
$env:GCLOUD_PROJECT = "rebecca-ai-gal-local"
npx ts-node -T apps/dashboard-backend/scripts/seed-db.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Seeding script completed with warnings or errors. Check logs." -ForegroundColor Yellow
} else {
    Write-Host "-> Database seeded successfully with mock timeline posts, active/blocked users, and KPI metrics!" -ForegroundColor Green
}

# 6. Start Bot Backend (gRPC Server on port 50051, HTTP port 8082 to avoid Firestore 8080 conflict)
Write-Host "[6/7] Starting Bot Backend (gRPC Server)..." -ForegroundColor Yellow
$BotCommand = "`$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; `$env:GCP_PROJECT_ID='rebecca-ai-gal-local'; `$env:PORT='8082'; npm run dev --workspace=bot-backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BotCommand -WorkingDirectory $PWD
Write-Host "-> Bot Backend launched (HTTP port 8082, gRPC port 50051)..." -ForegroundColor Gray

# 7. Start Dashboard Backend (BFF Server)
Write-Host "[7/7] Starting Dashboard Backend (BFF Server)..." -ForegroundColor Yellow
$BffCommand = "`$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; `$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'; `$env:GCP_PROJECT_ID='rebecca-ai-gal-local'; `$env:BOT_GRPC_URL='localhost:50051'; `$env:PORT='8081'; npm run dev --workspace=dashboard-backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BffCommand -WorkingDirectory $PWD
Write-Host "-> Dashboard BFF launched (HTTP port 8081)..." -ForegroundColor Gray

# 8. Start Dashboard Frontend (Angular Dev Server)
Write-Host "Starting Dashboard Frontend (Angular App)..." -ForegroundColor Yellow
$FrontendCommand = 'npm run dev --workspace=dashboard-frontend'
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand -WorkingDirectory $PWD
Write-Host "-> Dashboard Frontend launching (HTTP port 4200)..." -ForegroundColor Gray

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   ALL SERVICES STARTED SUCCESSFULLY!                     " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Access URLs:" -ForegroundColor White
Write-Host "   - Admin Dashboard UI:   http://localhost:4200/" -ForegroundColor Cyan
Write-Host "   - Firebase Emulator UI: http://127.0.0.1:4000/" -ForegroundColor Cyan
Write-Host "     * Auth Emulator:      http://127.0.0.1:4000/auth" -ForegroundColor Gray
Write-Host "     * Firestore Emulator: http://127.0.0.1:4000/firestore" -ForegroundColor Gray
Write-Host "   - BFF Backend Health:   http://localhost:8081/health" -ForegroundColor Cyan
Write-Host "   - Bot Backend gRPC:     localhost:50051" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Sign-in Credentials:" -ForegroundColor White
Write-Host "   - Email:    admin@example.com" -ForegroundColor Magenta
Write-Host "   - Password: password123" -ForegroundColor Magenta
Write-Host "   (Or click 'Sign in with Google' and use any dummy account)" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Press Ctrl+C in the spawned terminal windows to stop them." -ForegroundColor Yellow
