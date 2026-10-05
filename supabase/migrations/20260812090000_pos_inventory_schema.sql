-- =============================================================================
-- Digita POS & Inventory — core schema (Phase 1)
--
-- This runs inside a SHARED multi-app database (45 public tables serving
-- payroll, attendance, billing and CRM). Two consequences shape everything here:
--
--   1. Every table is prefixed `pos_`. Generic names like products, suppliers,
--      categories and locations are exactly the ones a future app will want,
--      and `payments`, `orders` and `work_locations` are already taken.
--   2. RLS reuses the existing SECURITY DEFINER helpers is_company_member() and
--      is_company_admin() rather than adding new ones. Writing fresh policies
--      that read `profiles` directly is what caused the recursive-policy
--      incident this database already recovered from.
--
-- Forward-only. Nothing here alters an existing table.
-- =============================================================================

begin;

-- --- Enums -------------------------------------------------------------------

create type public.pos_base_unit as enum ('g', 'ml', 'each');

-- raw_material  ingredient, bought and consumed
-- sub_assembly  prep item, produced in batches and consumed by other recipes
-- resale        bought and sold untouched
create type public.pos_item_type as enum ('raw_material', 'sub_assembly', 'resale');

create type public.pos_movement_reason as enum (
  'receipt', 'sale', 'waste', 'staff', 'count_adjustment',
  'transfer', 'prep_consume', 'prep_produce', 'void_return'
);

create type public.pos_product_type as enum ('composite', 'resale');
create type public.pos_recipe_owner_type as enum ('variant', 'modifier', 'prep');
create type public.pos_tender_method as enum ('cash', 'gcash', 'qr', 'card');
create type public.pos_discount_kind as enum ('senior', 'pwd', 'promo', 'comp', 'staff');
create type public.pos_sale_status as enum ('completed', 'voided', 'refunded');
create type public.pos_po_status as enum ('draft', 'ordered', 'partial', 'received', 'cancelled');
create type public.pos_count_status as enum ('open', 'completed', 'cancelled');

-- --- Locations & suppliers ---------------------------------------------------

create table public.pos_locations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  name         text not null,
  address      text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index pos_locations_company_name_key
  on public.pos_locations (company_id, lower(name));

create table public.pos_suppliers (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  name                 text not null,
  contact              text,
  link                 text,
  lead_time_days       integer not null default 3 check (lead_time_days >= 0),
  default_delivery_fee numeric(12, 2) not null default 0 check (default_delivery_fee >= 0),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index pos_suppliers_company_name_key
  on public.pos_suppliers (company_id, lower(name));

-- --- Inventory items ---------------------------------------------------------

create table public.pos_items (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  location_id        uuid references public.pos_locations (id) on delete set null,
  name               text not null,
  category           text not null default 'Uncategorised',
  item_type          public.pos_item_type not null default 'raw_material',

  base_unit          public.pos_base_unit not null,
  purchase_unit      text not null default 'Pack',
  -- Base units in one purchase unit. Numeric, not integer: a sauce bottle is
  -- 475.25 ml.
  pack_size          numeric(14, 4) not null check (pack_size > 0),
  -- Only needed when the label unit and the base unit disagree — a 2L bottle of
  -- chocolate sauce weighs about 2.6kg.
  density_g_per_ml   numeric(8, 4) check (density_g_per_ml > 0),

  -- Usable fraction of what you buy. Grinder retention, steaming loss, purge.
  yield_pct          numeric(5, 4) not null default 1 check (yield_pct > 0 and yield_pct <= 1),

  reorder_point      numeric(14, 4) not null default 0 check (reorder_point >= 0),
  par_level          numeric(14, 4) not null default 0 check (par_level >= 0),
  is_seasonal        boolean not null default false,
  supplier_id        uuid references public.pos_suppliers (id) on delete set null,
  shelf_life_days    integer check (shelf_life_days > 0),
  days_after_opening integer check (days_after_opening > 0),

  -- sub_assembly only: base units produced by one run of its prep recipe.
  prep_yield_qty     numeric(14, 4) check (prep_yield_qty > 0),

  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint pos_items_par_above_reorder check (par_level >= reorder_point),
  -- A prep item with no yield cannot be costed; the engine only warns, so the
  -- database refuses to store the state in the first place.
  constraint pos_items_prep_needs_yield
    check (item_type <> 'sub_assembly' or prep_yield_qty is not null)
);
create unique index pos_items_company_name_key
  on public.pos_items (company_id, lower(name));
create index pos_items_company_type_idx on public.pos_items (company_id, item_type);
create index pos_items_supplier_idx on public.pos_items (supplier_id);

-- How staff actually measure at the bar: pumps of syrup, scoops of powder.
-- Recipes are authored in these and stored in base units.
create table public.pos_item_dosing_units (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  item_id           uuid not null references public.pos_items (id) on delete cascade,
  name              text not null,
  base_qty_per_unit numeric(14, 4) not null check (base_qty_per_unit > 0),
  is_default        boolean not null default false,
  created_at        timestamptz not null default now()
);
create unique index pos_dosing_units_item_name_key
  on public.pos_item_dosing_units (item_id, lower(name));
create unique index pos_dosing_units_one_default
  on public.pos_item_dosing_units (item_id) where is_default;

-- --- Purchasing --------------------------------------------------------------

create table public.pos_purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  location_id  uuid references public.pos_locations (id) on delete set null,
  supplier_id  uuid references public.pos_suppliers (id) on delete set null,
  status       public.pos_po_status not null default 'draft',
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  ordered_at   timestamptz,
  expected_at  date,
  received_at  timestamptz,
  notes        text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index pos_purchase_orders_company_status_idx
  on public.pos_purchase_orders (company_id, status);

create table public.pos_purchase_order_lines (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  purchase_order_id  uuid not null references public.pos_purchase_orders (id) on delete cascade,
  item_id            uuid not null references public.pos_items (id) on delete restrict,
  qty_purchase_units numeric(14, 4) not null check (qty_purchase_units > 0),
  line_price         numeric(14, 2) not null check (line_price >= 0),
  expiry_date        date,
  created_at         timestamptz not null default now()
);
create index pos_po_lines_order_idx on public.pos_purchase_order_lines (purchase_order_id);

-- --- Stock -------------------------------------------------------------------

-- One row per receipt. Carries its own cost, so a sale costs against the batch
-- it actually consumed rather than a blended average.
create table public.pos_stock_batches (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  location_id       uuid references public.pos_locations (id) on delete set null,
  item_id           uuid not null references public.pos_items (id) on delete cascade,
  received_at       timestamptz not null default now(),
  expiry_date       date,
  qty_received      numeric(14, 4) not null check (qty_received > 0),
  qty_remaining     numeric(14, 4) not null check (qty_remaining >= 0),
  -- Landed and yield-adjusted. 6dp because a gram of milk is a fraction of a
  -- centavo and rounding to 2dp understates cost by ~3%.
  unit_cost         numeric(14, 6) not null check (unit_cost >= 0),
  is_open           boolean not null default false,
  purchase_order_id uuid references public.pos_purchase_orders (id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint pos_batches_remaining_within_received check (qty_remaining <= qty_received)
);
-- FEFO reads this constantly; expiry-first ordering with undated last.
create index pos_batches_fefo_idx
  on public.pos_stock_batches (item_id, location_id, expiry_date nulls last, received_at)
  where qty_remaining > 0;
-- At most one open container per item per location: that is the whole premise
-- of "N sealed + one open".
create unique index pos_batches_one_open_per_item
  on public.pos_stock_batches (item_id, location_id) where is_open;

-- Append-only ledger. on-hand is derived from batches and reconciled against
-- this; it is never a stored mutable field.
create table public.pos_stock_movements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  location_id  uuid references public.pos_locations (id) on delete set null,
  item_id      uuid not null references public.pos_items (id) on delete restrict,
  batch_id     uuid references public.pos_stock_batches (id) on delete set null,
  reason       public.pos_movement_reason not null,
  -- Signed, in base units. Negative consumes. Zero would be a no-op record.
  qty          numeric(14, 4) not null check (qty <> 0),
  cost_at_time numeric(14, 6) not null default 0,
  reference_id uuid,
  note         text,
  actor_id     uuid references auth.users (id) on delete set null,
  occurred_at  timestamptz not null default now()
);
create index pos_movements_item_time_idx
  on public.pos_stock_movements (item_id, occurred_at desc);
create index pos_movements_reason_time_idx
  on public.pos_stock_movements (company_id, reason, occurred_at desc);
create index pos_movements_reference_idx on public.pos_stock_movements (reference_id);

-- --- Stock counts ------------------------------------------------------------

create table public.pos_stock_counts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  location_id  uuid references public.pos_locations (id) on delete set null,
  status       public.pos_count_status not null default 'open',
  started_by   uuid references auth.users (id) on delete set null,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  note         text
);

create table public.pos_stock_count_lines (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  count_id       uuid not null references public.pos_stock_counts (id) on delete cascade,
  item_id        uuid not null references public.pos_items (id) on delete restrict,
  -- What the ledger said at the moment of counting, kept so the variance is
  -- still explicable after later movements.
  expected_qty   numeric(14, 4) not null,
  counted_qty    numeric(14, 4) not null check (counted_qty >= 0),
  variance_value numeric(14, 2) not null default 0,
  created_at     timestamptz not null default now()
);
create unique index pos_count_lines_unique on public.pos_stock_count_lines (count_id, item_id);

-- --- Products, variants, recipes --------------------------------------------

create table public.pos_products (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  name         text not null,
  category     text not null default 'Uncategorised',
  product_type public.pos_product_type not null default 'composite',
  image_url    text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index pos_products_company_name_key
  on public.pos_products (company_id, lower(name));

create table public.pos_product_variants (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  product_id        uuid not null references public.pos_products (id) on delete cascade,
  size              text not null default 'Regular',
  -- Integer centavos, VAT-inclusive, exactly as shown on the menu board.
  selling_price     integer not null check (selling_price >= 0),
  sku               text,
  target_margin_pct numeric(5, 2) check (target_margin_pct >= 0 and target_margin_pct < 100),
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index pos_variants_product_size_key
  on public.pos_product_variants (product_id, lower(size));

create table public.pos_modifier_groups (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid references public.pos_products (id) on delete cascade,
  name       text not null,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint pos_modifier_groups_range check (max_select >= min_select)
);

create table public.pos_modifiers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  group_id    uuid not null references public.pos_modifier_groups (id) on delete cascade,
  name        text not null,
  -- Centavos added to the variant's VAT-inclusive price. Negative is valid:
  -- "no whipped cream" can be a discount.
  price_delta integer not null default 0,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Owner is polymorphic: a variant, a modifier, or a sub_assembly item's prep
-- recipe. All three roll up identically, so a single table with owner_type is
-- simpler than three near-identical ones. No FK is possible on owner_id;
-- pos_recipe_lines_owner_exists enforces it instead.
create table public.pos_recipe_lines (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  owner_id       uuid not null,
  owner_type     public.pos_recipe_owner_type not null,
  item_id        uuid not null references public.pos_items (id) on delete restrict,
  -- As authored. Negative is valid on a modifier: an oat-milk swap removes
  -- 180ml of dairy and adds 180ml of oat.
  qty            numeric(14, 4) not null check (qty <> 0),
  dosing_unit_id uuid references public.pos_item_dosing_units (id) on delete set null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index pos_recipe_lines_owner_item_key
  on public.pos_recipe_lines (owner_id, item_id);
create index pos_recipe_lines_item_idx on public.pos_recipe_lines (item_id);

-- Every selling-price change, with the cost and margin at that moment, so a
-- past decision stays explicable after supplier prices move.
create table public.pos_price_history (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  variant_id           uuid not null references public.pos_product_variants (id) on delete cascade,
  old_price            integer,
  new_price            integer not null,
  cost_at_change       numeric(14, 6),
  margin_pct_at_change numeric(6, 2),
  changed_by           uuid references auth.users (id) on delete set null,
  changed_at           timestamptz not null default now()
);
create index pos_price_history_variant_idx
  on public.pos_price_history (variant_id, changed_at desc);

-- --- Shifts, sales, payments -------------------------------------------------

create table public.pos_shifts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  location_id   uuid references public.pos_locations (id) on delete set null,
  opened_by     uuid references auth.users (id) on delete set null,
  opened_at     timestamptz not null default now(),
  opening_float integer not null default 0,
  closed_at     timestamptz,
  counted_cash  integer,
  expected_cash integer,
  variance      integer,
  note          text
);
create index pos_shifts_company_open_idx
  on public.pos_shifts (company_id, opened_at desc);

create table public.pos_sales (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  location_id         uuid references public.pos_locations (id) on delete set null,
  shift_id            uuid references public.pos_shifts (id) on delete set null,
  receipt_no          text not null,
  -- employees.id is bigint in this database, not uuid.
  cashier_employee_id bigint references public.employees (id) on delete set null,
  subtotal            integer not null default 0,
  vat_amount          integer not null default 0,
  discount_total      integer not null default 0,
  total               integer not null default 0,
  status              public.pos_sale_status not null default 'completed',
  sold_at             timestamptz not null default now(),
  voided_at           timestamptz,
  voided_by           uuid references auth.users (id) on delete set null,
  void_reason         text,
  created_at          timestamptz not null default now()
);
create unique index pos_sales_company_receipt_key on public.pos_sales (company_id, receipt_no);
create index pos_sales_company_sold_idx on public.pos_sales (company_id, sold_at desc);
create index pos_sales_cashier_idx on public.pos_sales (cashier_employee_id, sold_at desc);

create table public.pos_sale_lines (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  sale_id            uuid not null references public.pos_sales (id) on delete cascade,
  variant_id         uuid references public.pos_product_variants (id) on delete set null,
  -- Denormalised so a receipt still reads correctly after a product is renamed
  -- or deleted.
  product_name       text not null,
  qty                numeric(10, 3) not null check (qty > 0),
  unit_price         integer not null,
  -- Cost of one unit at the moment of sale. NEVER recomputed from live cost:
  -- this is what keeps historical margin honest when supplier prices move.
  unit_cost_snapshot numeric(14, 6) not null default 0,
  line_vat           integer not null default 0,
  line_discount      integer not null default 0,
  created_at         timestamptz not null default now()
);
create index pos_sale_lines_sale_idx on public.pos_sale_lines (sale_id);
create index pos_sale_lines_variant_idx on public.pos_sale_lines (variant_id);

create table public.pos_sale_line_modifiers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  sale_line_id  uuid not null references public.pos_sale_lines (id) on delete cascade,
  modifier_id   uuid references public.pos_modifiers (id) on delete set null,
  modifier_name text not null,
  price_delta   integer not null default 0,
  cost_snapshot numeric(14, 6) not null default 0
);
create index pos_sale_line_modifiers_line_idx on public.pos_sale_line_modifiers (sale_line_id);

-- One row per tender, which is what makes split payments possible: part cash,
-- part GCash on the same sale.
create table public.pos_sale_payments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  sale_id      uuid not null references public.pos_sales (id) on delete cascade,
  method       public.pos_tender_method not null,
  amount       integer not null check (amount > 0),
  reference_no text,
  tendered     integer,
  change       integer,
  created_at   timestamptz not null default now()
);
create index pos_sale_payments_sale_idx on public.pos_sale_payments (sale_id);
create index pos_sale_payments_method_idx on public.pos_sale_payments (company_id, method, created_at desc);

create table public.pos_sale_discounts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  sale_id     uuid not null references public.pos_sales (id) on delete cascade,
  kind        public.pos_discount_kind not null,
  -- Senior and PWD require the ID for the statutory discount register.
  id_number   text,
  holder_name text,
  amount      integer not null check (amount >= 0),
  created_at  timestamptz not null default now(),

  constraint pos_discounts_statutory_needs_id
    check (kind not in ('senior', 'pwd') or (id_number is not null and length(btrim(id_number)) > 0))
);
create index pos_sale_discounts_sale_idx on public.pos_sale_discounts (sale_id);

-- Cashier PINs for the shared-tablet flow: the device signs in once as the
-- store, staff attribute each sale with a short PIN. Hashed with pgcrypto —
-- never stored in the clear.
create table public.pos_cashier_pins (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  employee_id bigint not null references public.employees (id) on delete cascade,
  pin_hash    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index pos_cashier_pins_employee_key on public.pos_cashier_pins (employee_id);

commit;
