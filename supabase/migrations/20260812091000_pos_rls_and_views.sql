-- =============================================================================
-- Digita POS & Inventory — RLS, integrity triggers, derived views (Phase 1)
--
-- Policies delegate to the database's existing SECURITY DEFINER helpers
-- is_company_member() / is_company_admin(). They already handle super-admin and
-- avoid reading `profiles` inside a policy, which is what produced the
-- infinite-recursion incident this database previously recovered from.
-- =============================================================================

begin;

-- --- updated_at --------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'pos_locations', 'pos_suppliers', 'pos_items', 'pos_purchase_orders',
    'pos_products', 'pos_product_variants', 'pos_recipe_lines', 'pos_cashier_pins'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end $$;

-- --- Recipe owner integrity --------------------------------------------------

-- owner_id is polymorphic so no foreign key can cover it. Without this, a
-- deleted variant leaves orphan recipe lines that silently cost nothing.
create or replace function public.pos_recipe_lines_owner_exists()
returns trigger
language plpgsql
as $$
begin
  if new.owner_type = 'variant' then
    if not exists (select 1 from public.pos_product_variants v where v.id = new.owner_id) then
      raise exception 'Recipe owner % is not a product variant', new.owner_id;
    end if;
  elsif new.owner_type = 'modifier' then
    if not exists (select 1 from public.pos_modifiers m where m.id = new.owner_id) then
      raise exception 'Recipe owner % is not a modifier', new.owner_id;
    end if;
  else
    if not exists (
      select 1 from public.pos_items i
      where i.id = new.owner_id and i.item_type = 'sub_assembly'
    ) then
      raise exception 'Recipe owner % is not a prep item', new.owner_id;
    end if;
    -- A prep recipe containing itself makes the cost roll-up non-terminating.
    if new.owner_id = new.item_id then
      raise exception 'A prep item cannot be an ingredient of itself';
    end if;
  end if;
  return new;
end $$;

create trigger pos_recipe_lines_owner_check
  before insert or update on public.pos_recipe_lines
  for each row execute function public.pos_recipe_lines_owner_exists();

-- Cascade recipe lines when their polymorphic owner disappears.
create or replace function public.pos_cleanup_recipe_lines()
returns trigger
language plpgsql
as $$
begin
  delete from public.pos_recipe_lines where owner_id = old.id;
  return old;
end $$;

create trigger pos_variant_recipe_cleanup
  after delete on public.pos_product_variants
  for each row execute function public.pos_cleanup_recipe_lines();

create trigger pos_modifier_recipe_cleanup
  after delete on public.pos_modifiers
  for each row execute function public.pos_cleanup_recipe_lines();

-- --- Derived stock -----------------------------------------------------------

-- On hand is never stored. Reading it from live batches means it cannot drift
-- from the ledger the way a mutable counter does.
create view public.pos_item_stock as
select
  i.id                                                as item_id,
  i.company_id,
  i.name,
  i.category,
  i.base_unit,
  i.purchase_unit,
  i.pack_size,
  i.reorder_point,
  i.par_level,
  coalesce(sum(b.qty_remaining), 0)                   as on_hand,
  coalesce(sum(b.qty_remaining) filter (where b.is_open), 0)      as open_qty,
  coalesce(sum(b.qty_remaining) filter (where not b.is_open), 0)  as sealed_qty,
  -- Weighted average across what is actually left, for menu pricing. Individual
  -- sales still cost against their own batch.
  case
    when coalesce(sum(b.qty_remaining), 0) > 0
      then sum(b.qty_remaining * b.unit_cost) / sum(b.qty_remaining)
    else (
      select b2.unit_cost from public.pos_stock_batches b2
      where b2.item_id = i.id order by b2.received_at desc limit 1
    )
  end                                                 as avg_unit_cost,
  min(b.expiry_date) filter (where b.qty_remaining > 0) as next_expiry
from public.pos_items i
left join public.pos_stock_batches b
  on b.item_id = i.id and b.qty_remaining > 0
where i.is_active
group by i.id;

-- Views run as their owner by default, which would bypass the caller's RLS.
alter view public.pos_item_stock set (security_invoker = true);

-- --- Row level security ------------------------------------------------------

-- Read and write for any member of the company; delete for admins only, so a
-- cashier cannot erase a sale or a stock batch.
do $$
declare t text;
begin
  foreach t in array array[
    'pos_locations', 'pos_suppliers', 'pos_items', 'pos_item_dosing_units',
    'pos_purchase_orders', 'pos_purchase_order_lines',
    'pos_stock_batches', 'pos_stock_movements',
    'pos_stock_counts', 'pos_stock_count_lines',
    'pos_products', 'pos_product_variants',
    'pos_modifier_groups', 'pos_modifiers', 'pos_recipe_lines', 'pos_price_history',
    'pos_shifts', 'pos_sales', 'pos_sale_lines', 'pos_sale_line_modifiers',
    'pos_sale_payments', 'pos_sale_discounts', 'pos_cashier_pins'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_company_member(company_id))',
      t || '_select', t
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_company_member(company_id))',
      t || '_insert', t
    );

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_company_member(company_id))
         with check (public.is_company_member(company_id))',
      t || '_update', t
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_company_admin(company_id))',
      t || '_delete', t
    );
  end loop;
end $$;

-- The stock ledger is append-only. An adjustment is a new row, never an edit —
-- otherwise the audit trail is worth nothing.
drop policy pos_stock_movements_update on public.pos_stock_movements;
drop policy pos_stock_movements_delete on public.pos_stock_movements;

-- Price history is likewise a record of what happened, not a working document.
drop policy pos_price_history_update on public.pos_price_history;
drop policy pos_price_history_delete on public.pos_price_history;

-- PIN hashes must never be readable by the client, even by an admin: the whole
-- point of hashing is that nothing round-trips them. Verification goes through
-- pos_verify_cashier_pin() below.
drop policy pos_cashier_pins_select on public.pos_cashier_pins;

-- --- Cashier PINs ------------------------------------------------------------

create or replace function public.pos_set_cashier_pin(p_employee_id bigint, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_company_id uuid;
begin
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'PIN must be 4 to 8 digits';
  end if;

  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null then
    raise exception 'Employee % has no company', p_employee_id;
  end if;
  if not public.is_company_admin(v_company_id) then
    raise exception 'Only a company admin can set a cashier PIN';
  end if;

  insert into public.pos_cashier_pins (company_id, employee_id, pin_hash)
  values (v_company_id, p_employee_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (employee_id)
  do update set pin_hash = excluded.pin_hash, is_active = true, updated_at = now();
end $$;

-- Returns the employee behind a PIN, or null. Never exposes the hash.
create or replace function public.pos_verify_cashier_pin(p_company_id uuid, p_pin text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee_id bigint;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not a member of this company';
  end if;

  select p.employee_id into v_employee_id
  from public.pos_cashier_pins p
  where p.company_id = p_company_id
    and p.is_active
    and p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
  limit 1;

  return v_employee_id;
end $$;

revoke all on function public.pos_set_cashier_pin(bigint, text) from public;
revoke all on function public.pos_verify_cashier_pin(uuid, text) from public;
grant execute on function public.pos_set_cashier_pin(bigint, text) to authenticated;
grant execute on function public.pos_verify_cashier_pin(uuid, text) to authenticated;

commit;
