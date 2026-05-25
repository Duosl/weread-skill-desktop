#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== WeRead Skill Desktop verification ==="
echo "Project: $ROOT_DIR"
echo

echo "=== 1/4 TypeScript typecheck ==="
npm run frontend:typecheck
echo

echo "=== 2/4 Frontend production build ==="
npm run frontend:build
echo

echo "=== 3/4 Rust cargo check ==="
(cd src-tauri && cargo check)
echo

echo "=== 4/4 Diff whitespace check ==="
git diff --check
echo

echo "=== Verification complete ==="
echo "Record this evidence in progress.md and session-handoff.md before marking a feature done."
