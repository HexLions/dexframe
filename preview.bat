@echo off
rem DexFrame - local preview of the control page (no ESP32 needed)
cd /d "%~dp0data\www"
set PY=
where py >nul 2>nul && set PY=py
if not defined PY where python >nul 2>nul && set PY=python
if not defined PY (
  echo Python not found. Install Python 3 from python.org and try again.
  pause
  exit /b 1
)
rem open the browser after 2 s, once the server is up
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8080/"
echo Preview at http://localhost:8080/  -  close this window to stop it.
%PY% -m http.server 8080 --bind 127.0.0.1
