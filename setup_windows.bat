@echo off
SETLOCAL ENABLEDELAYEDEXPANSION
color 0B
echo.
echo =========================================================
echo   HelpDesk AI - Automated Setup for Windows
echo =========================================================
echo.

:: Check Python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download from: https://www.python.org/downloads/
    pause & exit /b 1
)
echo [OK] Python found

:: Check Node.js
node --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download from: https://nodejs.org/
    pause & exit /b 1
)
echo [OK] Node.js found

:: Check PostgreSQL
psql --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [WARNING] psql not found in PATH. Make sure PostgreSQL is installed and running.
    echo Download from: https://www.postgresql.org/download/windows/
)

echo.
echo [STEP 1] Setting up Backend...
echo -------------------------------------------------------
cd backend

IF NOT EXIST .env (
    copy .env.example .env
    echo [INFO] Created backend\.env from .env.example
    echo [ACTION REQUIRED] Edit backend\.env and set your:
    echo   - DATABASE_URL  (PostgreSQL connection string)
    echo   - GEMINI_API_KEY (from https://makersuite.google.com/app/apikey)
    echo   - SECRET_KEY    (any random string)
    echo.
    pause
)

echo [STEP 2] Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo [STEP 3] Installing Python dependencies...
pip install --upgrade pip
pip install -r requirements.txt

cd ..

echo.
echo [STEP 4] Setting up Frontend...
echo -------------------------------------------------------
cd frontend
echo [STEP 5] Installing Node.js dependencies...
npm install
cd ..

echo.
echo =========================================================
echo   Setup Complete!
echo =========================================================
echo.
echo To START the application:
echo.
echo   Terminal 1 (Backend):
echo     cd backend
echo     venv\Scripts\activate
echo     python main.py
echo.
echo   Terminal 2 (Frontend):
echo     cd frontend
echo     npm start
echo.
echo   Then open: http://localhost:3000
echo.
pause
