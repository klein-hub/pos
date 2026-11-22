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
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$ select current_setting('request.jwt.claim.sub', true)::uuid $$;

-- Mirrors live: brand is NOT NULL there, and a migration that forgets it must
-- fail here rather than in production.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  slug text,
  currency text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key,
  company_id uuid references public.companies (id),
  role text not null default 'user'
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
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'
  )
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

-- The real Zenverse Cafe id, so the seed migration runs unmodified.
insert into public.companies (id, name, brand, currency)
values ('0e573ed8-ebe8-4e32-88aa-87100e838dab', 'Zenverse Cafe', 'Zenverse', 'PHP');
