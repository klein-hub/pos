#!/usr/bin/env bash
#
# Regenerates the catalog seed migration from packages/core/src/seed/catalog.ts.
#
#   ./scripts/gen-catalog.sh > supabase/migrations/<timestamp>_pos_seed_catalog.sql
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/run-ts.sh" scripts/gen-catalog-sql.ts
