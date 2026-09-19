#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo " Starting SpriteForge Studio (Desktop)... "
echo "=========================================="

if [ ! -f "dist/index.html" ]; then
    npm run build
fi

npx electron .
