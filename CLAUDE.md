# Digita POS & Inventory

Coffee shop POS + Inventory (mobile) and Sales Monitoring + Admin (web) for
**Zenverse Cafe**. The whole point of the system is costing accurate to the
gram: ingredient cost → recipe cost → markup → selling price → realised margin.

Read [SPEC.md](./SPEC.md) before changing the data model. It records the
decisions and, importantly, *why* — several are non-obvious and were chosen
against plausible alternatives.

## Layout

```
apps/web        Vite + React + Tailwind — public site: landing, pricing,
                checkout (:5176). Static; no Supabase. Netlify SPA redirect.
apps/hub        Vite + React — launcher + access console (:5175).
apps/admin      Vite + React + Chakra — Sales + Inventory + Admin (:5174)
apps/payroll    Vite + React + Chakra — payroll (:5173), plus an Express
                admin API on :3000 for the two service-role operations
apps/pos        Expo / React Native — the till (:8081)
packages/core   Shared types, Supabase client factory, and the costing engine
supabase/       Forward-only migrations against the shared database
scripts/        DB test harness, seed generation, dev account
```

### Signing in once

The apps sit on different ports, and a port is part of an origin, so none of
them share localStorage. The launcher therefore hands its session to the app
it opens, in the URL fragment — see `packages/core/src/apps/handoff.ts`, and
its duplicate at `payroll/src/lib/hubHandoff.ts`, which must stay in step.

A fragment never reaches a server or an access log and is stripped on arrival,
but it does pass through browser history: this is a development-grade handoff,
not a substitute for an identity provider once these are deployed apart.

`packages/core` is consumed as **TypeScript source**, not a build artifact —
editing the costing engine is live in both apps with no build step. That is why
`@digita/core` is in `optimizeDeps.exclude` in the Vite config.

## Commands

Tasks run through Turborepo, which caches by input hash — an untouched
package is skipped rather than rebuilt. `dev` stays on pnpm: long-lived
servers are not cacheable tasks.

```bash
pnpm install
pnpm dev:all          # hub :5175 · admin :5174 · payroll :5173
pnpm dev:admin        # Vite on :5174
pnpm test             # costing engine, 71 jest tests
pnpm typecheck        # all workspaces
./scripts/db-test.sh  # migrations + schema behaviour on a throwaway Postgres
```

## Non-negotiable conventions

These exist because violating them has already produced real, costed errors in
the shop's spreadsheets. They are not stylistic.

- **Money the customer sees is integer centavos.** Never a float. `toCentavos`
  / `formatPeso` in `packages/core/src/utils/money.ts`.
- **Per-base-unit costs carry 6 decimals.** Rounding a unit cost to 2dp
  understates milk by 2.78% and sugar by 3.85% — always downward. Round only at
  the display boundary.
- **Prices are VAT-inclusive; VAT is extracted, never added.** `extractVat`
  rounds net and takes VAT as the remainder so `net + vat === gross` exactly.
  Margin is measured against the **VAT-exclusive** price — including VAT
  inflates every margin by roughly 10 points.
- **Senior/PWD: strip the 12% VAT first, then take 20%** of the VAT-exempt
  amount. Discounting the gross over-refunds the customer and understates
  output VAT. This order is a common BIR finding.
- **Stock on hand is derived**, never a stored mutable counter. It is the sum
  of `qty_remaining` across live batches, reconcilable against the append-only
  `pos_stock_movements` ledger.
- **COGS is snapshotted onto each sale line** (`unit_cost_snapshot`) and never
  recomputed from live cost. This is what keeps historical margin honest when
  supplier prices move.
- **Tenant key is `company_id`** everywhere, shared with the payroll and
  attendance apps. Zenverse Cafe is `0e573ed8-ebe8-4e32-88aa-87100e838dab`.

## Item taxonomy

| Type | Meaning | Sellable | Example |
|---|---|---|---|
| `raw_material` | Ingredient, bought and consumed | no | beans, milk, 16oz cup |
| `sub_assembly` | Prep item, made in batch, consumed by recipes | no | espresso, cheesecake |
| `composite` | Assembled from a recipe at order time | yes | Iced Latte 16oz |
| `resale` | Bought and sold untouched | yes | bottled water |

The `sub_assembly` tier is what makes shot-level costing work, and it also
covers batch-produced food: a cheesecake is a `sub_assembly` with
`base_unit = 'each'` and `prep_yield_qty = 12`, and the sellable slice is a
`composite` of one cake plus its box and fork. **Packaging belongs in recipes**
— the box and fork are 4% of that slice.

## The shared database — read this before any migration

`digita-pos`, `payroll` and `attendance-tracker` all point at **one** Supabase
project (`Digita Database`, ref `peaotjteojnkrzkmtote`) with 68 public tables
serving several unrelated apps.

- **Every table here is `pos_`-prefixed.** `payments`, `orders` and
  `work_locations` were already taken; `products`, `suppliers` and `locations`
  are exactly what the next app will want.
- **RLS reuses the existing `is_company_member()` / `is_company_admin()`
  SECURITY DEFINER helpers.** Do not write a policy that reads `profiles`
  directly — that caused an infinite-recursion incident this database has
  already had to recover from once.
- **Forward-only.** Never edit an applied migration; add a new one. Never run
  `supabase db push` blindly.
- **Always `./scripts/db-test.sh` before applying anything to live.** The local
  harness has already caught two bugs that would have reached production.

Use the `shared-db-migration` skill for the full protocol.

### Applied vs pending

**All five migrations (`20260812090000`–`20260812094000`) are applied to live**
as of 2026-11-22, and recorded in `supabase_migrations.schema_migrations`.

`20261122120000_pos_seed_catalog` followed, adding the rest of the catalog.

Live now holds, for Zenverse Cafe: **39 items** (36 raw materials + 3 prep),
one location (Main Store), **10 products / 13 variants**, 4 modifier groups,
8 modifiers and **60 recipe lines**. No stock batches yet.
`pos_stock_batches.location_id` is `NOT NULL` with `ON DELETE RESTRICT` — the
two-open-containers defect is closed.

Costed from live, a Cheesecake batch comes to ₱1,006.62 over 12 slices =
₱83.89 each, matching the engine's test and the corrected spreadsheet.

Costs currently resolve with `cost_source = 'standard'` (the price list),
because nothing has been received yet. The first Receive Stock will flip the
items it touches to `'batch'`.

## Current state

Phases 0, 1 and 4 are done. Phase 1's schema exists; the admin app still runs
on seed data in `apps/admin/src/data/seedCatalog.ts` and has not been wired to
Supabase yet. `apps/pos` does not exist.

**Ingredient costs are the shop's real price list. Recipe quantities are
starter assumptions** and the UI says so. Do not present a margin derived from
them as fact.

Still missing from the price list, and each costs real money per drink: lids,
straws, ice, filtered water, tea, cup sleeves, oat milk. They are listed in
`missingItems` in `packages/core/src/seed/openingCosts.ts`. Until they exist,
drink costs read roughly 40–55% of the truth.
