-- =============================================================================
-- Tenant tiers, app licences, and closing three cross-tenant holes
--
-- Two kinds of administrator now exist, and they must never be confused:
--
--   Digita Admin (platform)   Digita's own staff. Identified by the JWT claim
--                             app_metadata.role = 'super_admin', which only the
--                             service role can set — a user cannot grant it to
--                             themselves. Creates companies, licenses apps,
--                             provisions anyone. is_platform_admin().
--
--   Company Owner (tenant)    A client's top administrator. Role 'owner' in one
--                             company's profiles. Full control of that company's
--                             users and access, limited to the apps the company
--                             has licensed. Nothing outside it.
--
-- Holes closed, each reproduced in the harness before fixing:
--
--   1. profiles_self_update was `id = auth.uid()` with no column limits, so any
--      user could set their own role = 'admin' and company_id = <any company>
--      and become an administrator of any tenant.
--   2. is_admin_user() is true for an admin of ANY company, and it gated
--      profiles select/update — so one client's admin could read and edit
--      every other client's users.
--   3. The same function gated writes to the global `roles` table, letting any
--      client's admin redefine roles for every tenant.
-- =============================================================================

begin;

-- --- Roles -------------------------------------------------------------------

insert into public.roles (name, description)
select 'owner', 'Company super admin — full control of their own company and its licensed apps'
where not exists (select 1 from public.roles where name = 'owner');

-- --- Platform and tenant checks ----------------------------------------------

/** Digita staff. An alias for is_super_admin(), named for what it means. */
create or replace function public.is_platform_admin()
returns boolean
language sql stable
as $$ select public.is_super_admin() $$;

/**
 * A profile's role, normalised. Profiles carry either role_id or the legacy
 * `role` text, inconsistently; reading both keeps older rows working.
 */
create or replace function public.profile_role(p_profile_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select lower(replace(coalesce(r.name, p.role, ''), ' ', '_'))
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = p_profile_id
$$;

create or replace function public.is_company_owner(company_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = $1
      and public.profile_role(p.id) = 'owner'
  ) or public.is_platform_admin()
$$;

/**
 * Administers this one company. 'owner' joins the existing admin roles; the
 * legacy 'super_admin' profile text still counts, but only within its own
 * company — platform-wide power comes from the JWT, never from a profile row.
 */
create or replace function public.is_company_admin(company_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.company_id = $1
      and public.profile_role(p.id) in ('owner', 'admin', 'super_admin')
  ) or public.is_platform_admin()
$$;

-- --- App licences ------------------------------------------------------------

-- What a company has bought. A user can only ever reach an app their company
-- licenses, whatever their individual grants say.
create table if not exists public.company_apps (
  company_id uuid not null references public.companies (id) on delete cascade,
  app_id     text not null,
  status     text not null default 'active'
             check (status in ('trial', 'active', 'suspended', 'cancelled')),
  seats      integer check (seats > 0),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, app_id)
);

comment on table public.company_apps is
  'Apps a company has licensed. Managed by Digita admins; billing will drive it later.';

drop trigger if exists company_apps_set_updated_at on public.company_apps;
create trigger company_apps_set_updated_at before update on public.company_apps
  for each row execute function public.set_updated_at();

alter table public.company_apps enable row level security;

drop policy if exists company_apps_select on public.company_apps;
create policy company_apps_select on public.company_apps
  for select to authenticated using (public.is_company_member(company_id));

-- Licensing is Digita's decision, not the client's.
drop policy if exists company_apps_write on public.company_apps;
create policy company_apps_write on public.company_apps
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

/** Apps currently usable by a company: active or on trial, and in date. */
create or replace function public.company_licensed_apps(p_company_id uuid)
returns text[]
language sql stable security definer
set search_path = public
as $$
  select coalesce(array_agg(app_id order by app_id), '{}'::text[])
  from public.company_apps
  where company_id = p_company_id
    and status in ('active', 'trial')
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
$$;

-- --- Who may use what --------------------------------------------------------

/**
 * A user's apps in a company: their grants, intersected with what the company
 * licenses. An owner gets every licensed app without needing grants — that is
 * what "company super admin" means. Digita admins get everything.
 */
create or replace function public.my_app_access(p_company_id uuid)
returns text[]
language sql stable security definer
set search_path = public
as $$
  select case
    when public.is_platform_admin() then
      array['attendance','employee','expense','inventory','payroll','pos','sales']
    when exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.company_id = p_company_id
        and public.profile_role(p.id) = 'owner'
    ) then public.company_licensed_apps(p_company_id)
    else coalesce((
      select array_agg(distinct a.app_id order by a.app_id)
      from public.app_access a
      join public.profiles p on p.id = auth.uid()
      left join public.roles r on r.id = a.role_id
      where a.company_id = p_company_id
        and p.company_id = p_company_id
        and (a.user_id = auth.uid() or a.role_id = p.role_id or lower(r.name) = lower(p.role))
        and a.app_id = any (public.company_licensed_apps(p_company_id))
    ), '{}'::text[])
  end
$$;

-- Return shape grows (role, can_manage), so it must be dropped first.
drop function if exists public.my_app_access_summary();
create function public.my_app_access_summary()
returns table (company_id uuid, company_name text, role text, can_manage boolean, apps text[])
language sql stable security definer
set search_path = public
as $$
  select c.id, c.name,
         case when public.is_platform_admin() and coalesce(p.company_id, '00000000-0000-0000-0000-000000000000') <> c.id
              then 'digita_admin' else coalesce(public.profile_role(p.id), 'member') end,
         public.is_company_admin(c.id),
         public.my_app_access(c.id)
  from public.companies c
  left join public.profiles p on p.id = auth.uid() and p.company_id = c.id
  where public.is_company_member(c.id)
  order by c.name
$$;
revoke all on function public.my_app_access_summary() from public;
grant execute on function public.my_app_access_summary() to authenticated;

-- Grants may only name apps the company licenses.
drop policy if exists app_access_write on public.app_access;
create policy app_access_write on public.app_access
  for all to authenticated
  using (public.is_company_admin(company_id))
  with check (
    public.is_company_admin(company_id)
    and (public.is_platform_admin() or app_id = any (public.company_licensed_apps(company_id)))
  );

-- --- Hole 1: profiles privileged columns -------------------------------------

/**
 * Who may change a profile's company or role.
 *
 * Row-level policies decide which rows a user can touch; they cannot say
 * "this row, but not these columns". This trigger does. Service-role writes
 * (auth.uid() is null — the provisioning function) pass, as do Digita admins.
 * A company admin may set roles inside their own company, may claim a profile
 * not yet attached to any company, may never move someone between companies,
 * may never change their own role, and only an owner may create an owner.
 */
create or replace function public.profiles_guard_privileged()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_new_role text;
begin
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.company_id is not distinct from old.company_id
     and new.role is not distinct from old.role
     and new.role_id is not distinct from old.role_id then
    return new;
  end if;

  if new.id = auth.uid() then
    raise exception 'You cannot change your own company or role'
      using errcode = '42501';
  end if;

  -- Removal: detaching someone from a company is allowed for that company's
  -- admins, and must not leave them holding a role.
  if tg_op = 'UPDATE' and new.company_id is null and old.company_id is not null then
    if public.is_company_admin(old.company_id) then
      return new;
    end if;
    raise exception 'Only an administrator of that company can remove people from it'
      using errcode = '42501';
  end if;

  if new.company_id is null or not public.is_company_admin(new.company_id) then
    raise exception 'Only an administrator of that company can assign people to it'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.company_id is not null
     and old.company_id is distinct from new.company_id then
    raise exception 'People cannot be moved between companies; remove and re-invite instead'
      using errcode = '42501';
  end if;

  v_new_role := lower(replace(coalesce(
    (select r.name from public.roles r where r.id = new.role_id), new.role, ''), ' ', '_'));

  if v_new_role = 'owner' and not public.is_company_owner(new.company_id) then
    raise exception 'Only a company owner can appoint another owner'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_privileged();

-- --- Hole 2: profiles visibility and edits scoped to the tenant ---------------

drop policy if exists profiles_admin_select on public.profiles;
create policy profiles_admin_select on public.profiles
  for select using (
    public.is_platform_admin()
    or company_id in (select g.company_id from public.get_user_companies() g)
  );

drop policy if exists profiles_admin_can_update on public.profiles;
create policy profiles_admin_can_update on public.profiles
  for update using (
    public.is_platform_admin()
    or (company_id is not null and public.is_company_admin(company_id))
    -- A freshly signed-up user has no company yet; an admin may attach them.
    -- The trigger still forbids moving anyone who already belongs somewhere.
    or company_id is null
  )
  with check (
    public.is_platform_admin()
    or (company_id is not null and public.is_company_admin(company_id))
    or id = auth.uid()
  );

drop policy if exists profiles_admin_can_insert on public.profiles;
create policy profiles_admin_can_insert on public.profiles
  for insert with check (
    public.is_platform_admin()
    or (company_id is not null and public.is_company_admin(company_id))
  );

-- --- Hole 3: the global roles table is Digita's ------------------------------

drop policy if exists roles_admin_can_insert on public.roles;
drop policy if exists roles_admin_can_update on public.roles;
drop policy if exists roles_admin_can_delete on public.roles;
create policy roles_platform_insert on public.roles
  for insert with check (public.is_platform_admin());
create policy roles_platform_update on public.roles
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy roles_platform_delete on public.roles
  for delete using (public.is_platform_admin());

-- Role names are not secret, and the access console has to list them.
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

-- --- Console reads and writes ------------------------------------------------

/** Every company, with licences and headcount. Digita admins only. */
create or replace function public.admin_companies()
returns table (
  id uuid, name text, brand text, email text, phone text, city text, country text,
  created_at timestamptz, members bigint, licensed text[]
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Digita admins only' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.brand, c.email, c.phone, c.city, c.country, c.created_at,
           (select count(*) from public.profiles p where p.company_id = c.id),
           public.company_licensed_apps(c.id)
    from public.companies c
    order by c.name;
end $$;

/** A company's people, with email (from auth.users) and individual grants. */
create or replace function public.company_members(p_company_id uuid)
returns table (
  user_id uuid, email text, first_name text, last_name text, role text,
  last_sign_in_at timestamptz, apps text[]
)
language plpgsql stable security definer
set search_path = public, auth
as $$
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Not an administrator of this company' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.first_name, p.last_name,
           coalesce(public.profile_role(p.id), 'member'),
           u.last_sign_in_at,
           case when public.profile_role(p.id) = 'owner'
                then public.company_licensed_apps(p_company_id)
                else coalesce((
                  select array_agg(distinct a.app_id order by a.app_id)
                  from public.app_access a
                  left join public.roles r on r.id = a.role_id
                  where a.company_id = p_company_id
                    and (a.user_id = p.id or a.role_id = p.role_id or lower(r.name) = lower(p.role))
                    and a.app_id = any (public.company_licensed_apps(p_company_id))
                ), '{}'::text[])
           end
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.company_id = p_company_id
    order by coalesce(p.first_name, u.email);
end $$;

/** Replace one person's individual app grants. Role-based grants are untouched. */
create or replace function public.set_member_apps(p_company_id uuid, p_user_id uuid, p_apps text[])
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_unlicensed text[];
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Not an administrator of this company' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and company_id = p_company_id) then
    raise exception 'That person is not in this company';
  end if;

  select array_agg(x) into v_unlicensed
  from unnest(p_apps) x
  where x <> all (public.company_licensed_apps(p_company_id));
  if v_unlicensed is not null then
    raise exception 'Not licensed for this company: %', array_to_string(v_unlicensed, ', ');
  end if;

  delete from public.app_access where company_id = p_company_id and user_id = p_user_id;
  insert into public.app_access (company_id, app_id, user_id)
  select p_company_id, x, p_user_id from unnest(p_apps) x;
end $$;

/** Change someone's role within a company. The profile trigger enforces the rules. */
create or replace function public.set_member_role(p_company_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role_id uuid;
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Not an administrator of this company' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not public.is_platform_admin() then
    raise exception 'You cannot change your own role';
  end if;
  if lower(p_role) = 'owner' and not public.is_company_owner(p_company_id) then
    raise exception 'Only a company owner can appoint another owner';
  end if;
  if lower(p_role) = 'super_admin' then
    raise exception 'Platform roles are not assigned through companies';
  end if;

  select id into v_role_id from public.roles where lower(name) = lower(p_role);
  if v_role_id is null then
    raise exception 'Unknown role %', p_role;
  end if;

  update public.profiles
  set role = lower(p_role), role_id = v_role_id
  where id = p_user_id and company_id = p_company_id;
  if not found then
    raise exception 'That person is not in this company';
  end if;
end $$;

/** Remove someone from a company. Their sign-in survives; their access does not. */
create or replace function public.remove_member(p_company_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_company_admin(p_company_id) then
    raise exception 'Not an administrator of this company' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;
  if public.profile_role(p_user_id) = 'owner' and not public.is_company_owner(p_company_id) then
    raise exception 'Only an owner can remove an owner';
  end if;

  delete from public.app_access where company_id = p_company_id and user_id = p_user_id;
  -- auth.uid() still reads the caller here — SECURITY DEFINER changes
  -- current_user, not the JWT — so the guard trigger re-checks this too.
  update public.profiles set company_id = null, role = 'user', role_id = null
  where id = p_user_id and company_id = p_company_id;
end $$;

/** Set exactly which apps a company licenses. Digita admins only. */
create or replace function public.set_company_licenses(p_company_id uuid, p_apps text[])
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Digita admins only' using errcode = '42501';
  end if;
  update public.company_apps set status = 'cancelled', ends_at = coalesce(ends_at, now())
  where company_id = p_company_id and app_id <> all (p_apps) and status in ('active', 'trial');
  insert into public.company_apps (company_id, app_id, status, starts_at, ends_at)
  select p_company_id, x, 'active', now(), null from unnest(p_apps) x
  on conflict (company_id, app_id) do update
    set status = 'active', ends_at = null, updated_at = now();
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_companies()', 'company_members(uuid)', 'set_member_apps(uuid, uuid, text[])',
    'set_member_role(uuid, uuid, text)', 'remove_member(uuid, uuid)',
    'set_company_licenses(uuid, text[])', 'company_licensed_apps(uuid)',
    'is_platform_admin()', 'is_company_owner(uuid)', 'profile_role(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- --- Seed: nothing that works today stops working ----------------------------

-- Licences now gate access, so every existing company starts licensed for
-- every app. Digita admins trim from there.
insert into public.company_apps (company_id, app_id, status)
select c.id, a.app_id, 'active'
from public.companies c
cross join unnest(array['attendance','employee','expense','inventory','payroll','pos','sales']) as a(app_id)
on conflict do nothing;

commit;
