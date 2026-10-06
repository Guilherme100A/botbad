#!/usr/bin/env bash
set -euo pipefail

echo "=== JEV Traffic Router — Validation ==="
echo ""

echo "[1/3] Type check..."
npm run typecheck
echo ""

echo "[2/3] Build..."
npm run build
echo ""

echo "[3/3] Test..."
if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "  NOTE: TEST_DATABASE_URL not set — API+Postgres integration tests will be skipped"
fi
npm test
echo ""

echo "=== Validation complete ==="
