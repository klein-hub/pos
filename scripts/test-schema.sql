-- Behavioural tests for the pos_ schema. Run against the local harness DB:
--   psql -d postest -f scripts/test-schema.sql
--
-- Asserts the things the schema is supposed to make impossible, plus one
-- end-to-end sale that proves cost snapshotting and FEFO ordering work.

\set ON_ERROR_STOP on
\set QUIET on
-- notice, not warning: every assertion reports through raise notice, and
-- suppressing them makes a passing run indistinguishable from one that never ran.
set client_min_messages = notice;

create or replace function pg_temp.must_fail(sql text, label text)
returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'PASS  %  (rejected: %)', label, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FAIL  % — the database accepted it', label;
end $$;

create or replace function pg_temp.check_eq(got anyelement, want anyelement, label text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL  % — got %, want %', label, got, want;
  end if;
  raise notice 'PASS  %  (%)', label, got;
end $$;

do $$
declare
  v_company uuid := '0e573ed8-ebe8-4e32-88aa-87100e838dab';
  v_loc     uuid;
  v_beans   uuid;
  v_milk    uuid;
  v_cup     uuid;
  v_esp     uuid;
  v_prod    uuid;
  v_variant uuid;
  v_emp     bigint;
  v_sale    uuid;
  v_cost    numeric;
begin
  select id into v_loc   from pos_locations where company_id = v_company limit 1;
  select id into v_beans from pos_items where name = 'Benguet Arabica Beans';
  select id into v_milk  from pos_items where name = 'Fresh Milk';
  select id into v_cup   from pos_items where name = '16 Oz Cup';

  -- ---- Item constraints -----------------------------------------------------

  perform pg_temp.must_fail(format(
    $q$insert into pos_items (company_id, name, base_unit, pack_size, yield_pct)
       values (%L, 'Bad Yield', 'g', 1000, 1.5)$q$, v_company),
    'yield_pct above 1 is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_items (company_id, name, base_unit, pack_size)
       values (%L, 'Bad Pack', 'g', 0)$q$, v_company),
    'zero pack size is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_items (company_id, name, base_unit, pack_size, reorder_point, par_level)
       values (%L, 'Bad Par', 'g', 1000, 500, 100)$q$, v_company),
    'par below reorder point is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_items (company_id, name, base_unit, pack_size, item_type)
       values (%L, 'Bad Prep', 'ml', 100, 'sub_assembly')$q$, v_company),
    'prep item without a yield is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_items (company_id, name, base_unit, pack_size)
       values (%L, 'fresh milk', 'ml', 1000)$q$, v_company),
    'duplicate item name (case-insensitive) is rejected');

  -- ---- Prep item + recipes --------------------------------------------------

  insert into pos_items (company_id, location_id, name, category, item_type,
                         base_unit, purchase_unit, pack_size, prep_yield_qty)
  values (v_company, v_loc, 'Espresso', 'Prep', 'sub_assembly', 'ml', 'Batch', 36, 36)
  returning id into v_esp;

  insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty)
  values (v_company, v_esp, 'prep', v_beans, 18);

  perform pg_temp.must_fail(format(
    $q$insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty)
       values (%L, %L, 'prep', %L, 1)$q$, v_company, v_esp, v_esp),
    'a prep item cannot be an ingredient of itself');

  perform pg_temp.must_fail(format(
    $q$insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty)
       values (%L, gen_random_uuid(), 'variant', %L, 1)$q$, v_company, v_milk),
    'recipe line pointing at a non-existent variant is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty)
       values (%L, %L, 'prep', %L, 0)$q$, v_company, v_esp, v_milk),
    'zero-quantity recipe line is rejected');

  insert into pos_products (company_id, name, category)
  values (v_company, 'Iced Latte', 'Espresso') returning id into v_prod;

  insert into pos_product_variants (company_id, product_id, size, selling_price, target_margin_pct)
  values (v_company, v_prod, '16oz', 16000, 70) returning id into v_variant;

  insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty) values
    (v_company, v_variant, 'variant', v_esp,  36),
    (v_company, v_variant, 'variant', v_milk, 180),
    (v_company, v_variant, 'variant', v_cup,  1);

  -- Negative quantities are legal: an oat-milk swap removes dairy and adds oat.
  insert into pos_modifier_groups (company_id, product_id, name) values (v_company, v_prod, 'Milk');
  insert into pos_modifiers (company_id, group_id, name, price_delta)
  values (v_company, (select id from pos_modifier_groups limit 1), 'Oat milk', 2000);
  insert into pos_recipe_lines (company_id, owner_id, owner_type, item_id, qty)
  values (v_company, (select id from pos_modifiers limit 1), 'modifier', v_milk, -180);

  -- ---- Costing before any stock exists --------------------------------------

  select avg_unit_cost into v_cost from pos_item_stock where item_id = v_milk;
  perform pg_temp.check_eq(round(v_cost, 6), 0.072000::numeric,
    'milk costs the price-list rate with no batches');
  perform pg_temp.check_eq(
    (select cost_source from pos_item_stock where item_id = v_milk), 'standard',
    'cost_source reports the price list');

  -- ---- Stock batches --------------------------------------------------------

  insert into pos_stock_batches (company_id, location_id, item_id, received_at, expiry_date,
                                 qty_received, qty_remaining, unit_cost, is_open)
  values
    (v_company, v_loc, v_milk, now() - interval '3 days', current_date + 20, 1000, 400, 0.072, true),
    (v_company, v_loc, v_milk, now() - interval '1 day',  current_date + 5,  1000, 1000, 0.080, false);

  -- location_id must be supplied on both of these: without it they are rejected
  -- by the NOT NULL rather than by the constraint under test, and would pass
  -- for the wrong reason.
  perform pg_temp.must_fail(format(
    $q$insert into pos_stock_batches (company_id, location_id, item_id, qty_received, qty_remaining, unit_cost, is_open)
       values (%L, %L, %L, 500, 500, 0.08, true)$q$, v_company, v_loc, v_milk),
    'a second open container for the same item is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_stock_batches (company_id, location_id, item_id, qty_received, qty_remaining, unit_cost)
       values (%L, %L, %L, 100, 500, 0.08)$q$, v_company, v_loc, v_milk),
    'remaining greater than received is rejected');

  perform pg_temp.must_fail(format(
    $q$insert into pos_stock_batches (company_id, item_id, qty_received, qty_remaining, unit_cost)
       values (%L, %L, 100, 100, 0.08)$q$, v_company, v_milk),
    'a batch with no location is rejected');

  perform pg_temp.check_eq(
    (select on_hand from pos_item_stock where item_id = v_milk), 1400::numeric,
    'on hand is derived from batches');

  -- (400 x 0.072 + 1000 x 0.080) / 1400
  perform pg_temp.check_eq(
    round((select avg_unit_cost from pos_item_stock where item_id = v_milk), 6),
    0.077714::numeric,
    'weighted average across remaining stock');

  -- FEFO: the open container first, then soonest expiry.
  perform pg_temp.check_eq(
    (select is_open from pos_stock_batches
     where item_id = v_milk and qty_remaining > 0
     order by is_open desc, expiry_date nulls last, received_at limit 1),
    true, 'FEFO puts the open container first');

  -- ---- A sale ---------------------------------------------------------------

  insert into employees (first_name, last_name, position, employment_type, company_id)
  values ('Test', 'Cashier', 'Barista', 'full_time', v_company) returning id into v_emp;

  insert into pos_sales (company_id, location_id, receipt_no, cashier_employee_id,
                         subtotal, vat_amount, total)
  values (v_company, v_loc, 'OR-000001', v_emp, 14286, 1714, 16000)
  returning id into v_sale;

  perform pg_temp.must_fail(format(
    $q$insert into pos_sales (company_id, receipt_no, total) values (%L, 'OR-000001', 100)$q$,
    v_company),
    'duplicate receipt number is rejected');

  insert into pos_sale_lines (company_id, sale_id, variant_id, product_name, qty,
                              unit_price, unit_cost_snapshot, line_vat)
  values (v_company, v_sale, v_variant, 'Iced Latte 16oz', 1, 16000, 25.698, 1714);

  -- Split payment: part cash, part GCash.
  insert into pos_sale_payments (company_id, sale_id, method, amount, tendered, change) values
    (v_company, v_sale, 'cash',  10000, 10000, 0),
    (v_company, v_sale, 'gcash', 6000, null, null);

  perform pg_temp.check_eq(
    (select sum(amount)::integer from pos_sale_payments where sale_id = v_sale), 16000,
    'split payments reconcile to the sale total');

  perform pg_temp.must_fail(format(
    $q$insert into pos_sale_discounts (company_id, sale_id, kind, amount)
       values (%L, %L, 'senior', 4571)$q$, v_company, v_sale),
    'a senior discount without an ID number is rejected');

  insert into pos_sale_discounts (company_id, sale_id, kind, id_number, holder_name, amount)
  values (v_company, v_sale, 'senior', 'SC-12345', 'Test Holder', 4571);

  -- The snapshot must survive a supplier price change.
  update pos_stock_batches set unit_cost = 0.200 where item_id = v_milk;
  perform pg_temp.check_eq(
    (select unit_cost_snapshot from pos_sale_lines where sale_id = v_sale), 25.698000::numeric,
    'COGS snapshot survives a later price change');

  -- ---- Ledger ---------------------------------------------------------------

  insert into pos_stock_movements (company_id, item_id, reason, qty, cost_at_time, reference_id)
  values (v_company, v_milk, 'sale', -180, 0.072, v_sale);

  perform pg_temp.must_fail(format(
    $q$insert into pos_stock_movements (company_id, item_id, reason, qty) values (%L, %L, 'waste', 0)$q$,
    v_company, v_milk),
    'a zero-quantity movement is rejected');

  -- ---- Cascade --------------------------------------------------------------

  delete from pos_product_variants where id = v_variant;
  perform pg_temp.check_eq(
    (select count(*)::integer from pos_recipe_lines where owner_id = v_variant), 0,
    'recipe lines are cleaned up when their variant is deleted');

  raise notice '--- all schema tests passed ---';
end $$;
