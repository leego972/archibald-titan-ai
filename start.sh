#!/bin/sh
# Railway startup script: start server immediately, run migrations in background

run_migrations() {
  echo "[Startup] Waiting for MySQL..."
  MAX_RETRIES=60
  RETRY_COUNT=0

  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    node -e "
      const mysql = require('mysql2/promise');
      const url = process.env.DATABASE_URL;
      if (!url) { process.exit(1); }
      mysql.createConnection(url)
        .then(conn => { conn.end(); process.exit(0); })
        .catch(() => process.exit(1));
    " 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "[Startup] MySQL ready! Running migrations..."
      npx drizzle-kit generate 2>&1 || true
      npx drizzle-kit migrate 2>&1 || echo "[Startup] Migration failed, tables may already exist"
      echo "[Startup] Migrations complete"
      return 0
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $((RETRY_COUNT % 10)) -eq 0 ]; then
      echo "[Startup] Still waiting for MySQL... ($RETRY_COUNT/$MAX_RETRIES)"
    fi
    sleep 3
  done

  echo "[Startup] WARNING: MySQL not available after $MAX_RETRIES retries"
  return 1
}

# Run migrations in background so the server starts immediately
run_migrations &

# Start the server immediately — it has its own DB connection retry logic
echo "[Startup] Starting server..."
exec node dist/index.js
