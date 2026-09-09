@echo off
setlocal

echo Starting Cyclone Intelligence Platform...
echo.

start "Cyclone API (backend)" cmd /k "cd /d %~dp0backend && set PYTHONIOENCODING=utf-8 && uvicorn app.main:app --reload --host 127.0.0.1 --port 8050"

timeout /t 3 /nobreak >nul

start "Cyclone Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:   http://localhost:8050
echo API Docs:  http://localhost:8050/docs
echo Frontend:  http://localhost:5173
echo.
echo Two terminal windows have been opened. Close them to stop the servers.
echo.
echo NOTE: if the backend seems to ignore code changes even after restarting,
echo the port may be stuck from a previous run in this environment - edit the
echo --port number above (and frontend/.env's VITE_API_URL) to a new, unused
echo port and restart both.
endlocal
