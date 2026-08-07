# Digita POS & Inventory — Specification

Coffee shop POS + Inventory (mobile) and Sales Monitoring + Admin (web).
Architecture mirrors the existing `payroll` app. Drafted 2026-08-07.

---

## 1. Decisions (locked)

| Area | Decision |
|---|---|
| Units | Base unit per item: `g` / `ml` / `each`, plus purchase-unit → base-unit conversion |
| Costing | Batch (FEFO) physical flow, actual-batch cost flow, weighted-average display cost, COGS snapshot per sale line |
| Open containers | N sealed units + remaining qty in one open container |
| Pricing | Price-led: user sets price, app shows cost + margin, warns under target |
| Modifiers | Sizes and add-ons fully costed |
| Waste | Yield % per ingredient, wastage log, staff/free drinks, theoretical-vs-actual variance |
| Expiry | Per received batch |
| Offline | Online-only for v1 |
| Branches | Single store, `location_id` carried from day one |
| Cashiers | Payroll `employees`; store-level device login + per-staff PIN |
| Payments | Cash, GCash/QR (manual ref), split payments |
| Tax | VAT-inclusive pricing, 12% backed out; senior/PWD (VAT-exempt + 20%) |
| Hardware | None — tablet/phone, digital receipts |
| Database | Existing Supabase project `Digita Database` (`peaotjteojnkrzkmtote`), tenant key `company_id` |

---

## 2. Repo layout

```
digita-pos/
├── apps/
│   ├── pos/            Expo / React Native — POS + Inventory (staff-facing)
│   └── admin/          Vite + React + TS — Sales Monitoring + Admin (owner-facing)
├── packages/
│   └── core/
│       ├── types/      DB types, shared domain types
│       ├── supabase/   client factory (web + RN storage adapters)
│       ├── costing/    ⭐ the costing engine — written once, used by both
│       └── utils/      currency, units, VAT, date
└── supabase/
    └── migrations/     forward-only, live DB is source of truth
```

**Stack** (matching payroll): React 18 · TypeScript · Zustand stores per domain · Chakra UI + Tailwind on web · Recharts · Supabase JS · Express service-role server for admin-only operations.

`packages/core/costing` is the reason for the monorepo: recipe cost roll-up, VAT extraction, margin, and reorder math must produce byte-identical numbers on the POS and in the admin dashboard.

---

## 3. Item taxonomy

| Type | Meaning | Sellable | Has recipe | Example |
|---|---|---|---|---|
| `raw_material` | **Ingredient** — bought, consumed | no | no | beans, milk, caramel sauce, 16oz cup |
| `sub_assembly` | **Prep item** — made in batch, consumed by recipes | no | yes | brewed espresso, simple syrup |
| `composite` | **Assembled product** — built at order time | yes | yes | Iced Latte 16oz |
| `resale` | **Stock product** — bought and sold as-is | yes | no | bottled water, supplier pastry |

The `sub_assembly` tier is what makes shot-level costing honest: an 18 g dose yielding 36 g of espresso, with grinder retention as yield loss, gives a real per-shot cost that a flat recipe cannot.

---

## 4. Data model

All tables carry `company_id uuid` and `location_id uuid`. RLS follows the payroll pattern (`SECURITY DEFINER` helpers, no recursive policies).

### Inventory

- **`suppliers`** — name, contact, link (FB/Shopee), lead_time_days, default_delivery_fee
- **`inventory_items`** — name, category, `item_type`, `base_unit` (`g`/`ml`/`each`), `purchase_unit` (Bottle/Pack/Case), `pack_size` (base units per purchase unit), `yield_pct`, `reorder_point`, `par_level`, `is_seasonal`, `supplier_id`, `shelf_life_days`
- **`stock_batches`** — item, received_at, expiry_date, `qty_received`, `qty_remaining` (base units), `unit_cost` (landed, per base unit), `is_open`, purchase_order_id
- **`stock_movements`** — append-only ledger: `receipt` · `sale` · `waste` · `staff` · `count_adjustment` · `transfer` · `prep_consume` · `prep_produce`. Signed qty, batch_id, cost_at_time, reference, actor.
- **`purchase_orders` / `purchase_order_lines`** — supplier, status (draft → ordered → received), delivery_fee, expected/received dates
- **`stock_counts` / `stock_count_lines`** — physical count sessions, counted_qty vs expected_qty, variance value

`on_hand` is never stored as a mutable field — it is the sum of `qty_remaining` across open batches, so it can always be reconciled against the movement ledger.

**Landed cost:** `unit_cost = (line_price + allocated_delivery_fee) / (qty × pack_size) / yield_pct`. Delivery fee is allocated across a PO by line value.

### Dosing units (recipes in the unit staff actually use)

Bar staff dose syrup in **pumps**, not grams. Each `inventory_item` may declare optional dosing units:

- **`item_dosing_units`** — item_id, name (`pump`, `scoop`, `shot`, `bar spoon`), `base_qty_per_unit` (e.g. 1 pump = 9 g), `is_default`

Recipes are *written* as `2 pumps` and *stored/costed* in base units. Calibration is a one-time task per bottle type (pump 10 times into a tared cup, weigh, divide by 10) and is re-checkable when a supplier changes bottle/pump design.

**Density:** the sheet mixes mass and volume in one column — sauces are `2L / Bottle`, syrups are `2.5kg / Bottle`. Chocolate sauce runs ~1.3 g/ml, so 2 L ≈ 2.6 kg. Items therefore carry an optional `density_g_per_ml`, and Receive Stock asks for the unit **printed on the label**, never a house-standard unit.

### Required item coverage

The current spreadsheet tracks only reorder-from-supplier goods (beans, sauces, powders, syrups). Costing needs the full bill of materials. Categories that must exist before any margin number is trustworthy:

| Category | Items | Why it matters |
|---|---|---|
| Dairy & alternatives | fresh milk, evap/condensed, oat, almond | Often the **largest** single cost in a milk drink — bigger than beans |
| Packaging | cups (12/16/22oz), lids, straws, sleeves, carriers, napkins | Frequently ₱8–14/drink; usually untracked entirely |
| Water & ice | filtered water, ice | Small but real; ice is a large mass fraction of iced drinks |
| Tea & others | tea leaves/bags, whipped cream, sugar, salt | |

Omitting these makes per-drink cost read roughly 40–55% of the truth, with margins that look excellent for the wrong reason.

### Products & recipes

- **`products`** — name, category, `product_type` (`composite` | `resale`), image, is_active, tax_treatment
- **`product_variants`** — size (12/16/22oz), selling_price (VAT-inclusive), sku, target_margin_pct
- **`recipe_lines`** — variant_id → (inventory_item | sub_assembly product), qty in base units
- **`modifiers` / `modifier_groups`** — add-ons with both a price delta and their own `recipe_lines` (extra shot = +18 g beans, oat milk = swap 180 ml dairy for 180 ml oat)
- **`price_history`** — every selling-price change with actor, timestamp, and the cost/margin at that moment

### Sales

- **`sales`** — receipt_no, cashier (employee_id), location, subtotal, vat_amount, discount, total, status (`completed` | `voided` | `refunded`), sold_at
- **`sale_lines`** — variant, qty, unit_price, **`unit_cost_snapshot`**, applied modifiers, line VAT
- **`sale_payments`** — one row per tender (supports splits): method (`cash` | `gcash` | `qr` | `card`), amount, reference_no, tendered/change
- **`discounts`** — senior/PWD with ID number and name capture, promo, comp
- **`shifts`** — open/close, opening cash float, expected vs counted cash, variance

### Costing rules

```
item cost/base unit  = weighted average of qty_remaining across open batches
recipe cost          = Σ (line qty ÷ yield_pct × item cost), recursive through sub_assemblies
variant cost         = recipe cost + Σ modifier costs
net price            = selling_price ÷ 1.12          (VAT-inclusive input)
margin %             = (net price − variant cost) ÷ net price
```

Sub-assembly recursion is depth-limited and cycle-checked.

---

## 5. Screens

### Mobile — `apps/pos`

**POS**
- Order screen: category tabs, product grid, size selector, modifier sheet, running cart
- Checkout: tender selection, split payments, cash/change, GCash reference entry
- Discounts: senior/PWD with ID capture, VAT-exempt recalculation
- Receipt: digital, QR/share
- Shift: open with float, close with cash count and variance

**Inventory**
- Item list: on-hand, status badge (computed), expiry warnings, days-of-cover
- **Receive Stock** ⭐ — supplier, items, qty, price paid, delivery fee, expiry. The keystone screen.
- Open/close container: mark a sealed unit opened, record remaining
- Wastage log: item, qty, reason (spill / spoil / remake / staff)
- Physical count: guided count session with variance report
- Prep production: make a batch of espresso/syrup, consuming ingredients

### Web — `apps/admin`

**Sales Monitoring**
- Dashboard: today/WTD/MTD sales, transactions, average ticket, gross margin, live-ish feed
- Sales by hour / day / product / category / cashier
- Payment method mix, discount usage

**Costing & Menu**
- Recipe builder with live cost roll-up per gram
- Price setter: enter price → see cost, VAT, margin, target warning
- **Menu engineering matrix**: margin × volume, four quadrants (Stars / Plowhorses / Puzzles / Dogs)
- Cost change alerts: "bean cost +14% — 9 drinks now under target margin"

**Inventory Admin**
- Item master, suppliers, categories, par levels
- Purchase orders and reorder suggestions (velocity × lead time)
- Movement speed — **computed** from trailing-4-week consumption
- Wastage report, theoretical-vs-actual variance, expiry watch
- Stock valuation

**Admin**
- Users/roles (reusing payroll `profiles` + `roles`), cashier PINs
- Locations, tax settings, receipt config, audit log

---

## 6. Improvements over the current spreadsheet

1. `ON HAND` becomes derived from the movement ledger instead of hand-typed
2. `TO BUY` computed and rounded up to whole purchase units (fixes the Matcha Powder `-7` formula bug)
3. `UNIT` text dropdown ("2.5kg / Bottle") split into `purchase_unit` + `pack_size` + `base_unit`
4. `MOVEMENT SPEED` measured from actual consumption, not judged; Seasonal stays a manual flag
5. `NOTE` (Instock / Need to Restock) computed from on_hand vs reorder_point — can no longer contradict the numbers
6. `DELIVERY FEE` moves to the supplier and is allocated into landed cost
7. `SUPPLIER` becomes a table with contact and lead time, not a merged cell with a URL
8. Blank spacer rows become real categories
9. Adds what the sheet has no concept of: **unit cost**, margin, expiry, partial containers, waste, and history
10. Adds the missing half of the bill of materials — milk, packaging, ice, tea — without which margins are fiction
11. Recipes written in **pumps/scoops**, costed in grams, so the model matches what happens at the bar
12. Par levels for fast/perishable items (beans: MAX 10 with ON HAND 10 and a 3–4 week freshness window) derived from velocity × lead time instead of a fixed ceiling
13. Slow/seasonal SKUs (blueberry, orange, lychee, passion fruit — all at 0, all SLOW/SEASONAL) surfaced in the menu matrix so dead stock gets a decision instead of a reorder

---

## 7. Build phases

| Phase | Scope |
|---|---|
| 0 | Monorepo scaffold, `packages/core`, Supabase client, auth, shared layout/theme |
| 1 | Schema migrations + RLS, seeded from the real item list |
| 2 | Inventory core: items, suppliers, batches, **Receive Stock**, movement ledger |
| 3 | Costing engine + unit tests (the numeric heart — test-first) |
| 4 | Recipes, variants, modifiers, price setter with margin display |
| 5 | POS: cart, checkout, tenders, VAT/discounts, shifts, stock deduction |
| 6 | Sales monitoring dashboards + reports |
| 7 | Waste, counts, variance, prep production |
| 8 | Reorder intelligence, purchase orders, menu engineering |

Phase 3 gets tests before UI. Everything downstream — every margin, every report, every reorder suggestion — is only as trustworthy as that engine.
