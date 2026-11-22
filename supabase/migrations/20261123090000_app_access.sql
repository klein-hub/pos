-- =============================================================================
-- Who may use which app
--
-- Layer 1 of three. The other two — a guard on each app's boot, and tile
-- filtering in the launcher — are conveniences. This is the one that actually
-- enforces: a user without inventory access gets no inventory rows, whatever
-- the UI does and whichever URL they type.
--
-- Named without a `pos_` prefix on purpose. This is platform-level and governs
-- every app in the suite (sales, inventory, pos, payroll, employee,
-- attendance, expense), not one application's data.
--
-- Deny by default. Access is granted to a ROLE within a company, or to one
-- USER within a company for an exception. Super admins bypass entirely, which
-- matches is_super_admin() and keeps one definition of "can see everything".
-- =============================================================================

begin;

create table public.app_access (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Matches the ids in packages/core/src/apps/registry.ts. Deliberately text
  -- rather than an enum: adding an app should not need a migration here.
  app_id     text not null,
  role_id    uuid references public.roles (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- A grant is to a role or to a person, never both and never neither.
  constraint app_access_one_subject check (num_nonnulls(role_id, user_id) = 1)
);

create unique index app_access_role_key
  on public.app_access (company_id, app_id, role_id) where role_id is not null;
create unique index app_access_user_key
  on public.app_access (company_id, app_id, user_id) where user_id is not null;
create index app_access_company_idx on public.app_access (company_id);

comment on table public.app_access is
  'Which apps a role or user may open, per company. Deny by default; super admins bypass.';

-- --- Resolving a caller's access ---------------------------------------------

/**
 * The apps the current user may use in a company.
 *
 * Roles are matched two ways because the data is inconsistent: some profiles
 * carry role_id, others only the legacy `role` text. Matching both means a
 * grant works regardless of which column that profile happens to use, rather
 * than silently denying people whose row predates role_id.
 */
create or replace function public.my_app_access(p_company_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then
      array['sales','inventory','pos','payroll','employee','attendance','expense']
    else coalesce(
      (
        select array_agg(distinct a.app_id)
        from public.app_access a
        join public.profiles p on p.id = auth.uid()
        left join public.roles r on r.id = a.role_id
        where a.company_id = p_company_id
          and p.company_id = p_company_id
          and (
            a.user_id = auth.uid()
            or a.role_id = p.role_id
            or lower(r.name) = lower(p.role)
          )
      ),
      '{}'::text[]
    )
  end
$$;

/** True when the caller may use any one of these apps in this company. */
create or replace function public.has_any_app_access(p_app_ids text[], p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_app_access(p_company_id) && p_app_ids
$$;

/**
 * Everything the signed-in user can reach, across every company they belong
 * to. The launcher calls this to decide which tiles to show.
 */
create or replace function public.my_app_access_summary()
returns table (company_id uuid, company_name text, apps text[])
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, public.my_app_access(c.id)
  from public.companies c
  where public.is_company_member(c.id)
    and array_length(public.my_app_access(c.id), 1) > 0
$$;

revoke all on function public.my_app_access(uuid) from public;
revoke all on function public.has_any_app_access(text[], uuid) from public;
revoke all on function public.my_app_access_summary() from public;
grant execute on function public.my_app_access(uuid) to authenticated;
grant execute on function public.has_any_app_access(text[], uuid) to authenticated;
grant execute on function public.my_app_access_summary() to authenticated;

-- --- The table governs itself ------------------------------------------------

alter table public.app_access enable row level security;

create policy app_access_select on public.app_access
  for select to authenticated using (public.is_company_member(company_id));

-- Only an admin may hand out access, and never to themselves by accident:
-- granting is an administrative act, not a user preference.
create policy app_access_write on public.app_access
  for all to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- --- Seed, so nothing that works today stops working -------------------------

-- Deny by default means an unseeded company locks everyone out. These grants
-- reproduce the access people effectively had before this migration, which is
-- what makes it safe to apply to a running system.
insert into public.app_access (company_id, app_id, role_id)
select c.id, a.app_id, r.id
from public.companies c
cross join (values
  ('admin',   'sales'), ('admin',   'inventory'), ('admin', 'pos'),
  ('admin',   'payroll'), ('admin', 'employee'), ('admin', 'attendance'), ('admin', 'expense'),
  ('manager', 'sales'), ('manager', 'inventory'), ('manager', 'pos'),
  ('manager', 'payroll'), ('manager', 'employee'), ('manager', 'attendance'), ('manager', 'expense'),
  -- A regular user runs the till and nothing else.
  ('user',    'pos'),
  -- A viewer sees trading, never stock movements or pay.
  ('viewer',  'sales')
) as a(role_name, app_id)
join public.roles r on lower(r.name) = a.role_name
on conflict do nothing;

-- Live profiles carry a legacy `role` text that does not always match a row in
-- `roles`: several say 'employee', which exists nowhere in that table. Without
-- a grant those users resolve to {} and would lose access the moment this
-- migration lands. Mapping the legacy name onto the same role keeps them
-- working; the text column should be retired once role_id is populated
-- everywhere.
insert into public.app_access (company_id, app_id, role_id)
select c.id, 'pos', r.id
from public.companies c
join public.roles r on r.name = 'user'
where exists (
  select 1 from public.profiles p
  where p.company_id = c.id and lower(p.role) = 'employee'
)
on conflict do nothing;

commit;
