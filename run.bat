@echo off
title SpriteForge Studio (Tauri 2.0 + Rust)
cd /d "%~dp0"

echo [SpriteForge Studio] Starting Native Rust + Tauri 2.0 Edition...

if not exist "src-tauri\target\release\app.exe" (
    echo [SpriteForge Studio] Building standalone application...
    call npm.cmd run tauri:build -- --no-bundle
)

echo [SpriteForge Studio] Launching standalone app...
start "" "src-tauri\target\release\app.exe"
exit /b 0
