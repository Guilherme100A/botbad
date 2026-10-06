#!/usr/bin/env bash
set -euo pipefail

echo "=== JEV Traffic Router — Validation ==="
echo ""

echo "[1/4] Type check..."
if command -v npx &>/dev/null && [ -f tsconfig.json ]; then
  npx tsc --noEmit
else
  echo "  SKIP: tsc not available or no tsconfig.json (dependencies not installed yet)"
fi
echo ""

echo "[2/4] Lint..."
if command -v npx &>/dev/null && npx eslint --version &>/dev/null 2>&1; then
  npx eslint .
else
  echo "  SKIP: eslint not configured yet"
fi
echo ""

echo "[3/4] Build..."
if command -v npx &>/dev/null && [ -f package.json ] && grep -q '"build"' package.json 2>/dev/null; then
  npm run build
else
  echo "  SKIP: build script not configured yet"
fi
echo ""

echo "[4/4] Test..."
if command -v npx &>/dev/null && [ -f package.json ] && grep -q '"test"' package.json 2>/dev/null; then
  npm test
else
  echo "  SKIP: test script not configured yet"
fi
echo ""

echo "=== Validation complete ==="
