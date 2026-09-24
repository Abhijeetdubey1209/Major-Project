@echo off
echo ========================================
echo Cyclone Intelligence Platform - Deploy
echo ========================================
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: cloudflared not found!
    echo.
    echo Please install it:
    echo   winget install --id Cloudflare.cloudflared
    echo.
    echo Or download from: https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b 1
)

echo Starting backend server...
cd backend
start "Backend Server" cmd /k "uvicorn app.main:app --host 0.0.0.0 --port 8050"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8050"

echo.
echo ========================================
echo IMPORTANT: Follow these steps:
echo ========================================
echo.
echo 1. Wait for the tunnel URL to appear in the "Cloudflare Tunnel" window
echo    It will look like: https://random-words.trycloudflare.com
echo.
echo 2. Copy that URL
echo.
echo 3. Go to your Vercel dashboard:
echo    https://vercel.com/dashboard
echo.
echo 4. Select your project ^> Settings ^> Environment Variables
echo.
echo 5. Add/Update:
echo    Key: VITE_API_URL
echo    Value: [paste the tunnel URL]
echo    Environment: Production
echo.
echo 6. Redeploy your frontend
echo.
echo ========================================
echo Backend running at: http://localhost:8050
echo Tunnel will be shown in the other window
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

taskkill /F /FI "WindowTitle eq Backend Server*" >nul 2>&1
taskkill /F /FI "WindowTitle eq Cloudflare Tunnel*" >nul 2>&1
echo Services stopped.
