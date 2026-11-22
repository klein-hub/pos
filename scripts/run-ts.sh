#!/usr/bin/env bash
#
# Compiles and runs a standalone TypeScript entry point under scripts/.
#
#   ./scripts/run-ts.sh scripts/whatever.ts [args...]
#
# Why not run the TypeScript directly: the core sources import each other with
# explicit .js specifiers, which Node's type stripping does not remap to .ts.
# Compiling emits real .js files, so those specifiers resolve as written.
# Output lands in a temp dir with no package.json, so Node reads the CommonJS
# emit as CommonJS. (esbuild would be faster, but the copy in this pnpm store
# is the raw platform binary rather than the JS launcher.)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRY="$1"; shift

TSC="$ROOT/packages/core/node_modules/.bin/tsc"
[ -x "$TSC" ] || { echo "tsc not found; run pnpm install" >&2; exit 1; }

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

"$TSC" "$ROOT/$ENTRY" \
  --outDir "$OUT" --rootDir "$ROOT" \
  --module commonjs --moduleResolution node \
  --target es2022 --skipLibCheck --esModuleInterop >&2

# A generator whose output is redirected into a migration file must never
# produce a short or empty one. A 2>/dev/null once hid a compile failure here
# and produced a migration silently missing all 36 raw materials, so emptiness
# is treated as failure rather than as valid output.
GENERATED=$(node "$OUT/${ENTRY%.ts}.js" "$@")
if [ "$(printf '%s' "$GENERATED" | wc -c)" -lt 200 ]; then
  echo "run-ts.sh: $ENTRY produced ${#GENERATED} bytes — treating as a failure." >&2
  exit 1
fi
printf '%s\n' "$GENERATED"
