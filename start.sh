#!/usr/bin/env bash
set -e

PROJECT_DIR="/home/nekono3/INSTA"

echo "=== 1. Starting PostgreSQL Database (Docker) ==="
cd "$PROJECT_DIR"
docker compose up -d

echo "=== 2. Starting FastAPI Backend on http://localhost:8000 ==="
cd "$PROJECT_DIR/backend"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

echo "=== 3. Starting Next.js Frontend on http://localhost:3000 ==="
cd "$PROJECT_DIR/frontend"
npm run dev -- -p 3000 > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo "=== 4. Starting Cloudflare Public Tunnel ==="
echo "Press Ctrl+C to stop all services."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
/home/nekono3/.local/bin/cloudflared tunnel --url http://localhost:8000
