-- Minimal stand-in for the shared Supabase database: only the upstream objects
-- the pos_ migrations actually depend on. Lets the migrations be tested locally
-- without touching the live multi-app database.
--
-- Shapes are copied from live: employees.id is bigint, profiles.id is uuid.

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  last_sign_in_at timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  -- As live Supabase defines it: an unset or emptied claim is NULL, not a cast
  -- error. A GUC set locally in an earlier transaction reverts to '' rather
  -- than NULL, so the nullif matters.
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

-- auth.jwt(), so is_super_admin() can be exercised from tests.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;


-- Mirrors live: brand is NOT NULL there, and a migration that forgets it must
-- fail here rather than in production.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  slug text,
  email text,
  phone text,
  website text,
  logo_url text,
  address text,
  city text,
  country text,
  subscription_plan text,
  subscription_status text,
  currency text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

insert into public.roles (name, description) values
  ('admin', 'Administrator role'),
  ('manager', 'Have access to all comapany data except delete'),
  ('super_admin', 'Have access to all'),
  ('user', 'Default role for regular users'),
  ('viewer', 'Read-only viewer');

create table public.profiles (
  id uuid primary key,
  company_id uuid references public.companies (id),
  role text not null default 'user',
  role_id uuid references public.roles (id),
  first_name text,
  last_name text
);

-- position and employment_type are NOT NULL with no default in live, so they
-- are here too: an insert that omits them must fail in the test, not only in
-- production. Found by scripts/check-harness-drift.sh.
create table public.employees (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  position text not null,
  employment_type text not null,
  company_id uuid references public.companies (id),
  auth_user_id uuid references auth.users (id)
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$
  select lower(replace(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() ->> 'user_role', ''
  ), ' ', '_')) = 'super_admin'
$$;

create or replace function public.is_company_member(company_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.company_id = $1
  ) or public.is_super_admin()
$$;

create or replace function public.is_company_admin(company_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = $1 and p.role in ('admin', 'owner')
  ) or public.is_super_admin()
$$;

-- Roles are cluster-wide, not per-database, so creating them must tolerate a
-- previous run of this harness against another database in the same cluster.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

-- Live lets these roles call auth.uid()/auth.jwt(). Without it, every RLS test
-- run as `authenticated` fails with "permission denied for schema auth" — which
-- a must_fail assertion happily reports as a pass, for entirely the wrong reason.
grant usage on schema auth to authenticated, anon;
grant execute on all functions in schema auth to authenticated, anon;

-- Live's tenancy helpers and policies on the shared tables, mirrored as they
-- were before 20261124090000 so that migration is tested against the real
-- starting point — including the holes it closes.
create or replace function public.get_user_companies()
returns table (company_id uuid, role text)
language sql stable security definer as $$
  select p.company_id, coalesce(nullif(trim(p.role), ''), 'employee')::text
  from public.profiles p where p.id = auth.uid() and p.company_id is not null
$$;

create or replace function public.is_admin_user() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(replace(coalesce(p.role, ''), ' ', '_')) in ('admin', 'super_admin')
  ) or public.is_super_admin()
$$;

create or replace function public.is_company_admin(company_id uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = $1
      and lower(replace(coalesce(p.role, ''), ' ', '_')) in ('admin', 'super_admin')
  ) or public.is_super_admin()
$$;

alter table public.companies enable row level security;
alter table public.profiles  enable row level security;
alter table public.roles     enable row level security;

create policy companies_select on public.companies for select using (
  public.is_super_admin() or id in (select g.company_id from public.get_user_companies() g));
create policy companies_insert on public.companies for insert with check (public.is_super_admin());
create policy companies_update on public.companies for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy companies_delete on public.companies for delete using (public.is_super_admin());

create policy profiles_self_select  on public.profiles for select using (id = auth.uid());
create policy profiles_admin_select on public.profiles for select using (
  public.is_admin_user() or company_id in (select g.company_id from public.get_user_companies() g));
create policy profiles_self_update  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_can_update on public.profiles for update using (public.is_admin_user()) with check (public.is_admin_user());
create policy profiles_admin_can_insert on public.profiles for insert with check (public.is_admin_user());

create policy roles_select_authenticated on public.roles for select using (
  public.is_super_admin() or id = (select p.role_id from public.profiles p where p.id = auth.uid()));
create policy roles_admin_can_insert on public.roles for insert with check (public.is_admin_user());
create policy roles_admin_can_update on public.roles for update using (public.is_admin_user()) with check (public.is_admin_user());
create policy roles_admin_can_delete on public.roles for delete using (public.is_admin_user());

-- The real Zenverse Cafe id, so the seed migration runs unmodified.
insert into public.companies (id, name, brand, currency)
values ('0e573ed8-ebe8-4e32-88aa-87100e838dab', 'Zenverse Cafe', 'Zenverse', 'PHP');
