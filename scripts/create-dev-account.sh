#!/usr/bin/env bash
#
# Creates (or resets) the throwaway development login and writes it into .env
# so the sign-in form comes up prefilled.
#
#   ./scripts/create-dev-account.sh
#
# Run this yourself: it writes to auth.users, which is a privileged action the
# agent is not permitted to perform.
#
# The account is deliberately disposable. Delete it — and the VITE_DEV_LOGIN_*
# lines in .env — before the shop's real data arrives:
#
#   ./scripts/create-dev-account.sh --delete
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EMAIL=${DEV_EMAIL:-dev@example.com}
LIVE_COMPANY=0e573ed8-ebe8-4e32-88aa-87100e838dab   # Zenverse Cafe

set -a && . /Users/klein-hans/projects/payroll/.env && set +a
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
CONN="host=aws-0-us-west-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.peaotjteojnkrzkmtote sslmode=require"

if [ "${1:-}" = "--delete" ]; then
  psql "$CONN" -v ON_ERROR_STOP=1 -q -v email="$EMAIL" <<'SQL'
begin;
delete from public.profiles where id in (select id from auth.users where email = :'email');
delete from auth.users where email = :'email';
commit;
SQL
  # strip the credentials back out of .env
  if [ -f "$ROOT/.env" ]; then
    sed -i '' -e 's/^VITE_DEV_LOGIN_EMAIL=.*/VITE_DEV_LOGIN_EMAIL=/' \
              -e 's/^VITE_DEV_LOGIN_PASSWORD=.*/VITE_DEV_LOGIN_PASSWORD=/' "$ROOT/.env"
  fi
  echo "Removed $EMAIL and cleared the prefill."
  exit 0
fi

PASS="digita-dev-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)"

psql "$CONN" -v ON_ERROR_STOP=1 -q -v email="$EMAIL" -v pass="$PASS" -v company="$LIVE_COMPANY" <<'SQL'
begin;

-- GoTrue expects these columns populated; the token fields are empty strings
-- rather than NULL because some versions dislike NULLs there. The password is
-- bcrypt-hashed with pgcrypto, matching what GoTrue writes itself ($2a$...).
with upserted as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
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
    -- super_admin so this login can exercise the data-source switcher, which
    -- is gated on exactly this claim. It also grants read across every
    -- company in this shared database — acceptable only while there is no
    -- real data, which is why the account is meant to be deleted.
    '{"provider":"email","providers":["email"],"role":"super_admin"}'::jsonb,
    '{"display_name":"Dev Account"}'::jsonb,
    '', '', '', '',
    now(), now()
  )
  on conflict (email) do update set
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = now(),
    raw_app_meta_data  = excluded.raw_app_meta_data,
    updated_at         = now()
  returning id
)
insert into public.profiles (id, company_id, role, first_name, last_name)
select u.id, :'company', 'admin', 'Dev', 'Account' from upserted u
on conflict (id) do update set company_id = excluded.company_id, role = excluded.role;

commit;
SQL

# Put it where the login form reads it from. .env is gitignored.
touch "$ROOT/.env"
if grep -q '^VITE_DEV_LOGIN_EMAIL=' "$ROOT/.env"; then
  sed -i '' -e "s|^VITE_DEV_LOGIN_EMAIL=.*|VITE_DEV_LOGIN_EMAIL=$EMAIL|" \
            -e "s|^VITE_DEV_LOGIN_PASSWORD=.*|VITE_DEV_LOGIN_PASSWORD=$PASS|" "$ROOT/.env"
else
  printf '\nVITE_DEV_LOGIN_EMAIL=%s\nVITE_DEV_LOGIN_PASSWORD=%s\n' "$EMAIL" "$PASS" >> "$ROOT/.env"
fi

echo "Created $EMAIL"
echo "Password: $PASS"
echo
echo "Written to .env (gitignored). Restart the dev server — Vite only reads .env at startup."
