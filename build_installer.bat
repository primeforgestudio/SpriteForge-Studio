@echo off
title SpriteForge Studio - Build Desktop App
cd /d "%~dp0"

echo ========================================================
echo   SpriteForge Studio - Desktop Distribution Builder
echo ========================================================
echo.

echo [1/2] Compiling TypeScript & Vite frontend...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Packaging Desktop Application with Electron Builder...
call npm.cmd run dist
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Packaging failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   Build SUCCESS!
echo   Binaries created in folder: "%~dp0release"
echo ========================================================
echo.
explorer "%~dp0release"
pause
