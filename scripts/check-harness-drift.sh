#!/usr/bin/env bash
#
# Compares the upstream tables the test harness stubs against their real shape
# in the live database.
#
#   ./scripts/check-harness-drift.sh
#
# The harness only has to model the columns the pos_ migrations touch, so an
# extra column in live is fine. What is not fine is live having a constraint
# the harness lacks: that is how a migration passes locally and fails in
# production. It happened once — the harness's `companies` stub was missing
# the NOT NULL `brand`, so an insert that omitted it only failed on live.
#
# Reports drift; does not fail the build, because live legitimately grows
# columns the harness will never care about.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a && . /Users/klein-hans/projects/payroll/.env && set +a
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
CONN="host=aws-0-us-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.peaotjteojnkrzkmtote sslmode=require"

TABLES=(companies profiles employees)
drift=0

for t in "${TABLES[@]}"; do
  echo "== $t"
  # Columns live requires (NOT NULL, no default) — the ones an insert must supply.
  required=$(psql "$CONN" -At -c "
    select column_name from information_schema.columns
    where table_schema='public' and table_name='$t'
      and is_nullable='NO' and column_default is null
    order by column_name;")

  for col in $required; do
    if grep -qE "^[[:space:]]*$col\b" "$ROOT/scripts/test-harness.sql"; then
      printf '   ok      %s (required by live, present in harness)\n' "$col"
    else
      printf '   DRIFT   %s is NOT NULL with no default in live, but absent from the harness\n' "$col"
      drift=$((drift + 1))
    fi
  done
done

echo
if [ "$drift" -eq 0 ]; then
  echo "No drift: every column live requires is modelled in the harness."
else
  echo "$drift column(s) drifted. A migration touching them would pass locally and fail on live."
  echo "Update scripts/test-harness.sql."
fi
