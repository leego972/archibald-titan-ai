# Archibald Titan — Desktop App

Standalone desktop application with embedded local server and SQLite database.
Works fully offline with AES-256-GCM encrypted credential storage.

## Architecture

- `main.js` — Electron main process, starts local server, creates window
- `preload.js` — Context bridge, exposes titanDesktop API
- `local-server.js` — Embedded Express + sql.js server (pure JavaScript SQLite, no native binaries)
- `build.sh` — One-command build script
- `splash.html` — Loading screen during startup

## How It Works

1. Electron starts embedded Express server on random port
2. sql.js (pure JS SQLite) database created at `~/.archibald-titan/titan.db`
3. BrowserWindow loads `http://127.0.0.1:{port}/desktop-login` or `/dashboard`
4. Local server handles desktop-specific APIs (`/api/desktop/*`, `/api/local/*`)
5. Frontend is served from `electron/public/` if built locally, or proxied from the remote server
6. All credentials encrypted with AES-256-GCM
7. License-based authentication with remote server validation

## Build Instructions

```bash
cd electron
chmod +x build.sh
./build.sh
npm run build:linux   # or build:win / build:mac
```

**Note:** sql.js is pure JavaScript — no native module rebuild needed.
Cross-platform builds work out of the box without `@electron/rebuild`.

## Security

- contextIsolation: true, nodeIntegration: false, sandbox: true
- Single instance lock prevents multiple app instances
- AES-256-GCM encryption for all credentials at rest
- Data stored locally at ~/.archibald-titan/
- License key validated against remote server
