#!/usr/bin/env bash
#
# Regenerates the catalog seed migration from packages/core/src/seed/catalog.ts.
#
#   ./scripts/gen-catalog.sh > supabase/migrations/<timestamp>_pos_seed_catalog.sql
#
# Compiles with tsc rather than running the TypeScript directly: the core
# sources import each other with explicit .js specifiers, which Node's type
# stripping does not remap to .ts. Compiling emits real .js files, so those
# specifiers resolve as written. Output goes to a temp dir with no
# package.json, so Node treats the CommonJS emit as CommonJS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TSC="$ROOT/packages/core/node_modules/.bin/tsc"
[ -x "$TSC" ] || { echo "tsc not found; run pnpm install" >&2; exit 1; }

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

"$TSC" "$ROOT/scripts/gen-catalog-sql.ts" \
  --outDir "$OUT" --rootDir "$ROOT" \
  --module commonjs --moduleResolution node \
  --target es2022 --skipLibCheck --esModuleInterop >&2

node "$OUT/scripts/gen-catalog-sql.js"
