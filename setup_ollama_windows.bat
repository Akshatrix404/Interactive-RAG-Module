@echo off
color 0B
echo.
echo =========================================================
echo   Ollama Setup for HelpDesk AI (Windows)
echo =========================================================
echo.
echo This script will:
echo   1. Check if Ollama is installed
echo   2. Pull the llama3.1 model (4.7 GB download)
echo.
echo NOTE: Make sure you have a stable internet connection.
echo.

:: Check if ollama is installed
ollama --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [INFO] Ollama is not installed.
    echo.
    echo Please install it manually:
    echo   1. Go to: https://ollama.com/download
    echo   2. Download "OllamaSetup.exe"
    echo   3. Run the installer
    echo   4. Come back and run this script again
    echo.
    start "" "https://ollama.com/download"
    pause
    exit /b 1
)

echo [OK] Ollama is installed: 
ollama --version

echo.
echo [STEP] Pulling llama3.1 model (4.7 GB - this will take a while)...
echo        You can see download progress below:
echo.
ollama pull llama3.1

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAILED] Could not pull llama3.1. Trying smaller llama3.2:3b instead...
    ollama pull llama3.2:3b
)

echo.
echo [INFO] Installed models:
ollama list

echo.
echo =========================================================
echo   Ollama Setup Complete!
echo =========================================================
echo.
echo Ollama runs automatically in the background.
echo The HelpDesk AI backend will detect it on startup.
echo.
echo If llama3.1 is too slow on your PC, try a smaller model:
echo   ollama pull llama3.2:3b    (2 GB, faster)
echo   ollama pull phi3:mini      (2.3 GB, fast)
echo   ollama pull mistral        (4.1 GB, good quality)
echo.
pause
