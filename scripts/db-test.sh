#!/usr/bin/env bash
#
# Runs the pos_ migrations and their behavioural tests against a throwaway
# local Postgres, with no connection to the shared production database.
#
#   ./scripts/db-test.sh
#
# Starts a cluster under $PGTMP on first use and reuses it afterwards. Every
# run rebuilds the test database from scratch, so results never depend on what
# a previous run left behind.
set -euo pipefail

# PostgreSQL 17 on macOS aborts at startup ("postmaster became multithreaded")
# unless a plain locale is set.
export LC_ALL=C LANG=C

PGTMP=${PGTMP:-/tmp/dpg}
DB=${DB:-postest}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Two ways to get a database.
#
#   PGHOST set  — use the server already there. This is how CI runs it, against
#                 a postgres service container; nothing is started or torn down.
#   otherwise   — start a throwaway cluster locally, reused between runs.
#
# Keeping both in one script matters: a CI-only path would drift from the one
# developers actually run, and the point of this harness is that the check
# before pushing is the same check that gates the push.
if [ -n "${PGHOST:-}" ]; then
  PGPORT=${PGPORT:-5432}
  PGUSER=${PGUSER:-postgres}
  export PGHOST PGPORT PGUSER
  echo "==> using the Postgres at $PGHOST:$PGPORT"
  psql() { command psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$@"; }
else
  PGPORT=${PGPORT:-54329}
  # Homebrew's libpq ships psql but no server; the full install has both.
  PGBIN=${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}
  if [ ! -x "$PGBIN/pg_ctl" ]; then
    echo "Postgres server binaries not found at $PGBIN — set PGBIN, or set PGHOST to use an existing server." >&2
    exit 1
  fi

  if [ ! -d "$PGTMP/data" ]; then
    echo "==> initialising cluster at $PGTMP"
    rm -rf "$PGTMP"; mkdir -p "$PGTMP"
    "$PGBIN/initdb" -D "$PGTMP/data" -U postgres --auth=trust -E UTF8 >/dev/null
  fi

  if ! "$PGBIN/pg_ctl" -D "$PGTMP/data" status >/dev/null 2>&1; then
    echo "==> starting server on port $PGPORT"
    "$PGBIN/pg_ctl" -D "$PGTMP/data" \
      -o "-p $PGPORT -k $PGTMP -c listen_addresses=''" \
      -l "$PGTMP/log" start >/dev/null
    sleep 2
  fi

  psql() { command psql -h "$PGTMP" -p "$PGPORT" -U postgres "$@"; }
fi

mkdir -p "$PGTMP"
run() { psql -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

psql -q -c "drop database if exists $DB;" -c "create database $DB;"

echo "==> upstream harness"
run -f "$ROOT/scripts/test-harness.sql" >/dev/null

echo "==> migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '    %-56s ' "$(basename "$f")"
  if run -f "$f" >/dev/null 2>"$PGTMP/err"; then
    echo "ok"
  else
    echo "FAILED"; sed 's/^/        /' "$PGTMP/err"; exit 1
  fi
done

echo "==> seed is idempotent"
run -f "$ROOT"/supabase/migrations/*_pos_seed_zenverse.sql >/dev/null
printf '    items: %s   locations: %s\n' \
  "$(run -Atc 'select count(*) from pos_items;')" \
  "$(run -Atc 'select count(*) from pos_locations;')"

echo "==> schema behaviour"
# Exit status, not just the NOTICE lines. Piping psql straight into sed
# discarded its status, so a failing assertion printed nothing and the script
# still reported success — which it did, for one commit.
if psql -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/test-schema.sql" >"$PGTMP/schema.log" 2>&1; then
  sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /    /p' "$PGTMP/schema.log"
else
  sed -n 's/^psql:[^:]*:[0-9]*: NOTICE:  /    /p' "$PGTMP/schema.log"
  echo
  echo "    SCHEMA TESTS FAILED:"
  grep -E "ERROR|DETAIL|CONTEXT" "$PGTMP/schema.log" | sed 's/^/      /' | head -12
  exit 1
fi

echo
echo "All database tests passed."
