#!/usr/bin/env bash
#
# Diffs the in-memory seed catalog against the one in the database.
#
#   ./scripts/check-catalog-parity.sh                 # against live
#   DB=local ./scripts/check-catalog-parity.sh        # against the test cluster
#
# The apps are about to start reading the catalog from Supabase instead of from
# the JS seed. That swap is only safe if the two agree exactly — otherwise a
# number silently changes the moment the data source does.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPANY=${COMPANY:-0e573ed8-ebe8-4e32-88aa-87100e838dab}
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

if [ "${DB:-live}" = "local" ]; then
  export LC_ALL=C LANG=C
  PSQL=(psql -h /tmp/dpg -p 54329 -U postgres -d postest)
else
  # Credentials: the local .env when it exists, otherwise the environment —
  # which is how CI supplies them, with no file on disk.
  if [ -f /Users/klein-hans/projects/payroll/.env ]; then
    set -a && . /Users/klein-hans/projects/payroll/.env && set +a
  fi
  if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
    echo "SUPABASE_DB_PASSWORD is not set, and no local .env was found." >&2
    exit 1
  fi
  export PGPASSWORD="$SUPABASE_DB_PASSWORD"
  PSQL=(psql "host=aws-0-us-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.peaotjteojnkrzkmtote sslmode=require")
fi

"$ROOT/scripts/run-ts.sh" scripts/dump-seed-catalog.ts > "$WORK/seed.json"
"${PSQL[@]}" -At -v ON_ERROR_STOP=1 -v company="$COMPANY" -f "$ROOT/scripts/dump-db-catalog.sql" \
  | sed '/^$/d' > "$WORK/db.json"

# Re-serialise both through the same formatter so key order and whitespace
# cannot masquerade as a difference. Keys are sorted recursively because jsonb
# orders them alphabetically while JavaScript preserves insertion order.
norm() {
  node -e '
    const fs = require("fs");
    const sort = (v) =>
      Array.isArray(v) ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
        : v;
    process.stdout.write(JSON.stringify(sort(JSON.parse(fs.readFileSync(process.argv[1], "utf8"))), null, 2));
  ' "$1"
}
norm "$WORK/seed.json" > "$WORK/seed.n.json"
norm "$WORK/db.json"   > "$WORK/db.n.json"

if diff -u "$WORK/seed.n.json" "$WORK/db.n.json" > "$WORK/diff.txt"; then
  echo "Catalog parity: seed and database match exactly."
else
  echo "Catalog parity: DIFFERENCES FOUND (seed = -, database = +)"
  echo
  sed -n '1,120p' "$WORK/diff.txt"
  exit 1
fi
