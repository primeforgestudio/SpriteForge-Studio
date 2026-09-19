#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo " Starting SpriteForge Studio... "
echo "=========================================="

# Check if already running on port 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "Server already running on port 5173. Opening browser..."
    open "http://localhost:5173"
    exit 0
fi

# Open browser after 1 second
(sleep 1.5 && open "http://localhost:5173") &

# Start dev server
npm run dev
