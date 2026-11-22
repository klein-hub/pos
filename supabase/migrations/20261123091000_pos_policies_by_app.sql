-- =============================================================================
-- Gate every pos_ table on app access, not just company membership
--
-- Before this, any member of the company could read every POS table. That was
-- fine while everyone was an admin; it is not fine once someone is meant to
-- have Sales but not Inventory.
--
-- The policies are dropped and rebuilt from one declarative map rather than
-- patched in place. Patching twenty-three tables by hand is how the
-- append-only exceptions (the stock ledger, price history) and the
-- no-select-at-all exception (PIN hashes) get quietly lost.
-- =============================================================================

begin;

do $$
declare
  spec record;
  t text;
  apps text;
begin
  for spec in
    select * from (values
      -- Stock and buying. The till needs these too: selling deducts stock.
      ('pos_items',                array['inventory','pos']),
      ('pos_item_dosing_units',    array['inventory','pos']),
      ('pos_suppliers',            array['inventory']),
      ('pos_stock_batches',        array['inventory','pos']),
      ('pos_stock_movements',      array['inventory','pos']),
      ('pos_stock_counts',         array['inventory']),
      ('pos_stock_count_lines',    array['inventory']),
      ('pos_purchase_orders',      array['inventory']),
      ('pos_purchase_order_lines', array['inventory']),

      -- What was sold. Inventory does not need to see takings.
      ('pos_sales',                array['sales','pos']),
      ('pos_sale_lines',           array['sales','pos']),
      ('pos_sale_line_modifiers',  array['sales','pos']),
      ('pos_sale_payments',        array['sales','pos']),
      ('pos_sale_discounts',       array['sales','pos']),
      ('pos_shifts',               array['sales','pos']),
      ('pos_cashier_pins',         array['sales','pos']),

      -- The catalog is shared: pricing is a Sales concern, recipes are an
      -- Inventory one, and the till reads both.
      ('pos_products',             array['sales','inventory','pos']),
      ('pos_product_variants',     array['sales','inventory','pos']),
      ('pos_modifier_groups',      array['sales','inventory','pos']),
      ('pos_modifiers',            array['sales','inventory','pos']),
      ('pos_recipe_lines',         array['sales','inventory','pos']),
      ('pos_price_history',        array['sales','inventory','pos']),
      ('pos_locations',            array['sales','inventory','pos'])
    ) as v(table_name, app_ids)
  loop
    t := spec.table_name;
    apps := quote_literal('{' || array_to_string(spec.app_ids, ',') || '}') || '::text[]';

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    -- PIN hashes stay unreadable by anyone. Verification goes through
    -- pos_verify_cashier_pin(); the whole point of hashing is that nothing
    -- round-trips them.
    if t <> 'pos_cashier_pins' then
      execute format(
        'create policy %I on public.%I for select to authenticated
           using (public.is_company_member(company_id)
                  and public.has_any_app_access(%s, company_id))',
        t || '_select', t, apps);
    end if;

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_company_member(company_id)
                     and public.has_any_app_access(%s, company_id))',
      t || '_insert', t, apps);

    -- The stock ledger and price history are append-only: an adjustment is a
    -- new row, never an edit, or the audit trail is worth nothing.
    if t not in ('pos_stock_movements', 'pos_price_history') then
      execute format(
        'create policy %I on public.%I for update to authenticated
           using (public.is_company_member(company_id)
                  and public.has_any_app_access(%s, company_id))
           with check (public.is_company_member(company_id)
                       and public.has_any_app_access(%s, company_id))',
        t || '_update', t, apps, apps);

      execute format(
        'create policy %I on public.%I for delete to authenticated
           using (public.is_company_admin(company_id)
                  and public.has_any_app_access(%s, company_id))',
        t || '_delete', t, apps);
    end if;
  end loop;
end $$;

commit;
