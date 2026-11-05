@echo off
title SpriteForge Studio (Tauri 2.0 + Rust)
cd /d "%~dp0"

echo [SpriteForge Studio] Starting Native Rust + Tauri 2.0 Edition...

if not exist "dist\index.html" (
    echo [SpriteForge Studio] Building frontend assets...
    call npm.cmd run build
)

if exist "src-tauri\target\release\app.exe" (
    echo [SpriteForge Studio] Launching optimized native app...
    start "" "src-tauri\target\release\app.exe"
    exit /b 0
)

if exist "src-tauri\target\debug\app.exe" (
    echo [SpriteForge Studio] Launching development build...
    start "" "src-tauri\target\debug\app.exe"
    exit /b 0
)

echo [SpriteForge Studio] Launching via Tauri CLI...
call npm.cmd run tauri:dev
