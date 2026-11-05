@echo off
title SpriteForge Studio - Build Standalone App (Tauri 2.0 + Rust)
cd /d "%~dp0"

echo ========================================================
echo   SpriteForge Studio - Standalone Desktop Builder
echo ========================================================
echo.

set "PATH=C:\Users\arakelyan.d\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin;C:\Users\arakelyan.d\.cargo\bin;%PATH%"

echo [1/2] Building Vite & TypeScript frontend...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Compiling native binary with Tauri 2.0...
call npx.cmd tauri build --no-bundle
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Tauri compilation failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================================
echo   Build SUCCESS! Standalone binary:
echo   "%~dp0src-tauri\target\release\app.exe"
echo ========================================================
pause
