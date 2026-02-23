#!/bin/bash
set -e
echo "=== Archibald Titan Desktop Build ==="
cd "$(dirname "$0")/.."
echo "[1/3] Building frontend..."
pnpm build
echo "[2/3] Copying to electron/public..."
mkdir -p electron/public
cp -r dist/public/* electron/public/
echo "[3/3] Installing Electron deps..."
cd electron && npm install
echo ""
echo "Ready! Build for your platform:"
echo "  npm run build:win    (Windows .exe)"
echo "  npm run build:linux  (Linux AppImage)"
echo "  npm run build:mac    (macOS .zip)"
echo "  npm run build:all    (All platforms)"
echo ""
echo "NOTE: sql.js is pure JavaScript — no native module rebuild needed."
echo "      Cross-platform builds work out of the box."
