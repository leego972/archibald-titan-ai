#!/bin/bash
set -e
echo "=== Archibald Titan Desktop Build ==="
cd "$(dirname "$0")/.."
echo "[1/3] Building frontend..."
pnpm build
echo "[2/3] Copying to electron/public..."
mkdir -p electron/public
cp -r dist/public/* electron/public/
echo "[2b] Cleaning development artifacts from desktop build..."
# Remove Manus sandbox debug tools (not for production)
rm -rf electron/public/__manus__
# Remove unresolved Vite analytics placeholder and Manus scripts from index.html
python3 -c "
import re
f = 'electron/public/index.html'
c = open(f).read()
c = re.sub(r'\\s*<script\\s+defer\\s+src=\\"%VITE_ANALYTICS_ENDPOINT%/umami\\"\\s+data-website-id=\\"%VITE_ANALYTICS_WEBSITE_ID%\\"></script>', '', c)
c = re.sub(r'<script src=\\"/__manus__/debug-collector\\.js\\" defer></script>', '', c)
c = re.sub(r'<script id=\\"manus-runtime\\">.*?</script>', '', c, flags=re.DOTALL)
open(f, 'w').write(c)
print('  Cleaned index.html')
"
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
