@echo off
title SpriteForge Studio
cd /d "%~dp0"

if not exist "dist\index.html" (
    echo Building SpriteForge Studio...
    call npm.cmd run build
)

start "" npx.cmd electron .
