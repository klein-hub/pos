#!/usr/bin/env bash
#
# Creates (or resets) the throwaway development login and writes it into .env
# so the sign-in form comes up prefilled.
#
#   ./scripts/create-dev-account.sh
#   ./scripts/create-dev-account.sh --delete
#
# Run this yourself: it writes to auth.users, which is a privileged action the
# agent is not permitted to perform.
#
# The account is deliberately disposable. Delete it — and the VITE_DEV_LOGIN_*
# lines in .env — before the shop's real data arrives.
set -euo pipefail

# An earlier version failed with no output at all, so the reason was lost.
# Everything is logged, and a failure names its own line.
LOG=${LOG:-/tmp/create-dev-account.log}
exec > >(tee "$LOG") 2>&1
trap 'echo "FAILED at line $LINENO (exit $?). Full log: $LOG" >&2' ERR

echo "create-dev-account.sh starting…"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMAIL=${DEV_EMAIL:-dev@example.com}
LIVE_COMPANY=0e573ed8-ebe8-4e32-88aa-87100e838dab   # Zenverse Cafe

set -a && . /Users/klein-hans/projects/payroll/.env && set +a
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
CONN="host=aws-0-us-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.peaotjteojnkrzkmtote sslmode=require"

clear_env_prefill() {
  [ -f "$ROOT/.env" ] || return 0
  sed -i '' -e 's/^VITE_DEV_LOGIN_EMAIL=.*/VITE_DEV_LOGIN_EMAIL=/' \
            -e 's/^VITE_DEV_LOGIN_PASSWORD=.*/VITE_DEV_LOGIN_PASSWORD=/' "$ROOT/.env"
}

if [ "${1:-}" = "--delete" ]; then
  psql "$CONN" -v ON_ERROR_STOP=1 -q -v email="$EMAIL" <<'SQL'
begin;
delete from public.profiles where id in (select id from auth.users where email = :'email');
delete from auth.users where email = :'email';
commit;
SQL
  clear_env_prefill
  echo "Removed $EMAIL and cleared the prefill."
  exit 0
fi

# Not `tr -dc ... </dev/urandom | head -c N`: that pipeline can take SIGPIPE
# under `set -o pipefail`. openssl needs no pipe at all.
PASS="digita-dev-$(openssl rand -hex 3)"
echo "generated a password (${#PASS} chars); creating the account…"

psql "$CONN" -v ON_ERROR_STOP=1 -q -v email="$EMAIL" -v pass="$PASS" -v company="$LIVE_COMPANY" <<'SQL'
begin;

-- Two statements, deliberately, not one with a CTE.
--
-- auth.users carries AFTER INSERT triggers: handle_new_user() inserts into
-- public.profiles with no ON CONFLICT of its own, and another application's
-- convo_assist schema hooks the same event. An AFTER trigger fires at the end
-- of its statement, so writing the profile inside a CTE here would insert it
-- first and leave the trigger colliding with it. Let the trigger create the
-- row; shape it in the next statement.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  :'email',
  extensions.crypt(:'pass', extensions.gen_salt('bf')),
  now(),
  -- super_admin so this login can exercise the data-source switcher, which is
  -- gated on exactly this claim. It also grants read across every company in
  -- this shared database — acceptable only while there is no real data, which
  -- is why the account is meant to be deleted.
  '{"provider":"email","providers":["email"],"role":"super_admin"}'::jsonb,
  '{"display_name":"Dev Account"}'::jsonb,
  -- Explicit: the only unique index on email is users_email_partial_key,
  -- UNIQUE (email) WHERE (is_sso_user = false).
  false,
  -- Empty strings rather than NULL. The token columns carry unique indexes
  -- predicated on NOT matching '^[0-9 ]*$', and '' does match, so empty
  -- tokens fall outside those indexes and cannot collide between users.
  '', '', '', '',
  now(), now()
)
-- The predicate has to be repeated: ON CONFLICT cannot target a partial index
-- without it.
on conflict (email) where (is_sso_user = false) do update set
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = now(),
  raw_app_meta_data  = excluded.raw_app_meta_data,
  updated_at         = now();

-- The trigger has run by now, so the profile exists either way: freshly made
-- for a new user, or already present for one being reset.
update public.profiles p set
  company_id = :'company',
  role       = 'admin',
  first_name = 'Dev',
  last_name  = 'Account'
where p.id = (select u.id from auth.users u where u.email = :'email');

commit;
SQL

echo "account written; updating .env…"

# Put it where the login form reads it from. .env is gitignored.
touch "$ROOT/.env"
if grep -q '^VITE_DEV_LOGIN_EMAIL=' "$ROOT/.env"; then
  sed -i '' -e "s|^VITE_DEV_LOGIN_EMAIL=.*|VITE_DEV_LOGIN_EMAIL=$EMAIL|" \
            -e "s|^VITE_DEV_LOGIN_PASSWORD=.*|VITE_DEV_LOGIN_PASSWORD=$PASS|" "$ROOT/.env"
else
  printf '\nVITE_DEV_LOGIN_EMAIL=%s\nVITE_DEV_LOGIN_PASSWORD=%s\n' "$EMAIL" "$PASS" >> "$ROOT/.env"
fi

echo
echo "Created $EMAIL"
echo "Password: $PASS"
echo
echo "Written to .env (gitignored). Restart the dev server — Vite reads .env only at startup."
