# Payroll

Philippine payroll web app (Vite + React + TypeScript) for Digita. Shares one
Supabase database with the `attendance-tracker` (Expo) and `digita-pos` repos.

## Commands

```bash
npm run dev          # Vite client only
npm run dev:all      # Express admin API (:3000) + Vite client together
npm test             # jest, src/**/__tests__/*.test.ts
npm run lint
npm run build
```

## Layout

```
src/pages        one screen per route (Employees, PayRuns, Attendance, …)
src/store        zustand, one store per domain; each queries Supabase directly
src/components   layout/, admin/, employee/, payroll/, Attendance/, ui/
src/lib          supabase client, payrollService (the calculation core)
server.js        Express admin API — needs the service role key to create
                 auth.users records; never expose that key to the client
```

Stores follow one shape: `{ items, loading, error, fetchX, addX, updateX,
deleteX }`, reading `activeCompanyId` from `authStore` and filtering every
query by it. Match that shape when adding one.

## Tenancy and identity

- **Tenant key is `company_id` (uuid)** on `companies`, `employees`,
  `profiles`, `attendance`. Standardise on it — `business_id` was half-built
  and is being dropped.
- **`employees.id` is `bigint`**, not uuid. `profiles.id` is uuid and equals
  `auth.users.id`.
- Join attendance to payroll on `attendance.user_id = employees.auth_user_id`,
  **not** on `employees.id`.

## The shared database — read this before any migration

`payroll`, `attendance-tracker` and `digita-pos` all point at **one** Supabase
project (`Digita Database`, ref `peaotjteojnkrzkmtote`) with 68 public tables,
most belonging to other apps (clients, orders, billing_payment, plans).

- **This repo's `supabase/migrations/` is not a faithful record of live.** It
  diverged historically. Treat the live database as the source of truth and
  introspect before assuming a column exists.
- **Never run `supabase db push` blindly.** It would attempt to replay history
  that live has already moved past.
- **Forward-only.** Add a migration; never edit an applied one.
- RLS uses the SECURITY DEFINER helpers `is_company_member()`,
  `is_company_admin()`, `is_admin_user()`, `get_user_companies()`. Do not write
  a policy that reads `profiles` directly — that caused an infinite-recursion
  incident this database has already recovered from.

Use the `shared-db-migration` skill for the connection details and the full
backup → local-test → apply protocol.

## Related repos

- `../digita-pos` — POS + Inventory, same database, all tables `pos_`-prefixed.
  Cashiers are `employees` rows, so a sale links back to payroll and attendance.
- `attendance-tracker` — Expo app writing `attendance` rows.
