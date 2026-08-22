#!/bin/sh
set -eu
cd /workspace
export VITE_AUTH_ENABLED=false
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
if [ -n "${DATABASE_URL:-}" ]; then
  npm run worker >>/tmp/worker.log 2>&1 &
fi
