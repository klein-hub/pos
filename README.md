# Digita POS & Inventory

Coffee shop POS + Inventory (mobile) and Sales Monitoring + Admin (web), with
costing accurate to the gram.

See [SPEC.md](./SPEC.md) for the data model, screens and build phases.

## Layout

```
apps/pos      Expo / React Native — POS + Inventory (staff)
apps/admin    Vite + React — Sales Monitoring + Admin (owner)
packages/core Shared types, Supabase client, and the costing engine
supabase/     Forward-only migrations
```

`packages/core` is consumed as TypeScript source, so a change to the costing
engine is live in both apps without a build step.

## Getting started

```bash
pnpm install
```

Copy the env template and fill in the Supabase keys:

```bash
cp .env.example .env
```

Both apps read that one file at the repo root. The admin build **fails loudly**
if the keys are missing — without that guard Vite folds them to `undefined`,
the client's guard clause becomes unconditional, and Rollup silently strips the
entire Supabase client out of the bundle.

Run the admin app:

```bash
pnpm dev:admin
```

Run the tests:

```bash
pnpm test
```

## Conventions

- **Money is integer centavos** everywhere a customer sees it. Per-base-unit
  costs are floats at 6dp, because a gram of milk is a fraction of a centavo.
- **Prices are VAT-inclusive.** VAT is always *extracted*, never added, and
  margin is always measured against the VAT-exclusive price.
- **Stock on hand is derived** from the movement ledger, never stored as a
  mutable field.
- **COGS is snapshotted** onto each sale line so historical margin survives
  supplier price changes.
- Tenant key is `company_id`, shared with the payroll and attendance apps.

## Status

Phases 0–5 and 7 are done. 142 tests; schema, RLS and the full catalog applied
to the shared Supabase database for both the live and demo companies.

The admin app reads its catalog from a switchable source — live, demo, or the
built-in offline sample — chosen by a super admin. Everything else (stock,
sales, counts) is still in memory; `apps/pos` runs on a demo backend.

Checks worth running: `./scripts/db-test.sh`, `./scripts/check-catalog-parity.sh`
and `./scripts/check-harness-drift.sh`.
