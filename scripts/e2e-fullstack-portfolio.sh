#!/usr/bin/env bash
# Phase 60E — repeatable local FULL-STACK portfolio-download E2E environment.
#
# Boots a real Atlas stack (real Postgres + real API server + real frontend) and
# leaves it running so you can drive a real browser against the portfolio
# download flow. Everything here is LOCAL/TEST only — the gated test-auth adapter
# (ATLAS_E2E_AUTH) is dead code in production (see artifacts/api-server/src/lib/auth.ts).
#
# Prereqs (one-time): Docker Postgres `atlas-pg` on :5434, Node 24 on PATH,
# `pnpm install` done. The token below is a throwaway local sentinel — it only
# unlocks the SEEDED test user and ONLY when ATLAS_E2E_AUTH=1 + NODE_ENV!=production.
#
# Usage:  bash scripts/e2e-fullstack-portfolio.sh
# Then drive the browser with playwright-cli (commands printed at the end).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${DATABASE_URL:?set DATABASE_URL to your local Docker Postgres, e.g. postgresql://USER:PASS@localhost:5434/postgres}"
export ATLAS_E2E_AUTH=1
export ATLAS_E2E_AUTH_TOKEN="${ATLAS_E2E_AUTH_TOKEN:-e2e-fullstack-local-token}"
export ATLAS_E2E_AUTH_CLERK_ID="${ATLAS_E2E_AUTH_CLERK_ID:-e2e_test_user}"
export NODE_ENV=development
API_PORT="${API_PORT:-5055}"
FE_PORT="${FE_PORT:-4178}"
SLUG="${ATLAS_E2E_PROJECT_SLUG:-analytics-engineer-semantic-layer-with-dbt-and-duckdb}"

echo "==> [1/5] Seeding project catalog (idempotent) + E2E test user/completion"
pnpm --filter @workspace/scripts run seed >/dev/null 2>&1 || true
pnpm --filter @workspace/scripts run seed:e2e

echo "==> [2/5] Building API server"
pnpm --filter @workspace/api-server run build >/dev/null

echo "==> [3/5] Building frontend E2E bundle (wired to the real API)"
VITE_E2E_API_BASE="http://127.0.0.1:${API_PORT}" \
VITE_E2E_API_TOKEN="${ATLAS_E2E_AUTH_TOKEN}" \
  pnpm --filter @workspace/atlas exec vite build --config vite.e2e.config.ts >/dev/null

echo "==> [4/5] Booting API server on :${API_PORT}"
( cd artifacts/api-server && PORT="${API_PORT}" node --enable-source-maps ./dist/index.mjs ) \
  > /tmp/atlas-e2e-api.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "    api healthz: %{http_code}\n" "http://127.0.0.1:${API_PORT}/api/healthz"

echo "==> [5/5] Serving frontend on :${FE_PORT}"
( cd artifacts/atlas/dist/e2e && python -m http.server "${FE_PORT}" --bind 127.0.0.1 ) \
  > /tmp/atlas-e2e-fe.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "    frontend: %{http_code}\n" "http://127.0.0.1:${FE_PORT}/"

echo ""
echo "Stack is up:"
echo "  API:      http://127.0.0.1:${API_PORT}   (logs: /tmp/atlas-e2e-api.log)"
echo "  Frontend: http://127.0.0.1:${FE_PORT}    (logs: /tmp/atlas-e2e-fe.log)"
echo ""
echo "Drive the real browser (global playwright-cli):"
echo "  playwright-cli open http://127.0.0.1:${FE_PORT}/"
echo "  playwright-cli snapshot          # find the Download Portfolio Bundle ref"
echo "  playwright-cli click <ref>"
echo "  playwright-cli eval \"() => window.__E2E_DOWNLOAD__\""
echo ""
echo "API-level sanity (real DB + real gated auth adapter):"
echo "  curl -H \"X-Atlas-E2E-Auth: ${ATLAS_E2E_AUTH_TOKEN}\" http://127.0.0.1:${API_PORT}/api/user/projects/${SLUG}/portfolio-artifact"
