---
name: verify
description: Run the full Digita POS verification pass — costing engine tests, typecheck across workspaces, production build, and the local database migration suite. Use before committing, before claiming a phase is done, or when asked to check that everything still works.
---

# Verify

Run all four gates. They are fast (well under a minute together), so run them
all rather than guessing which one a change could have broken — the costing
engine, the apps and the schema are coupled through `packages/core`.

```bash
cd /Users/klein-hans/projects/digita-pos
pnpm test                 # costing engine (jest)
pnpm typecheck            # every workspace
pnpm --filter @digita/admin build
./scripts/db-test.sh      # migrations + schema behaviour, throwaway Postgres
```

Report what actually happened, including counts. "71 tests passing" is a
useful claim; "tests pass" is not.

## Reading the build output

The admin bundle should split into roughly:

```
index     ~95 kB     app code
supabase  ~218 kB
charts    ~388 kB
chakra    ~463 kB
```

**If the `supabase` chunk is missing or near-zero, the build is broken even
though it succeeded.** With no `.env`, Vite folds `import.meta.env.VITE_*` to
`undefined`, the client's guard clause becomes unconditional, and Rollup
dead-code-eliminates the entire Supabase library — a 65 kB bundle and a white
screen in production. A `requireEnv` plugin in `vite.config.ts` is meant to
catch this; if it ever reports a missing key, fix the `.env` at the repo root
rather than removing the guard.

## Visual verification

Tests do not catch a chart rendering mid-animation or a button that offers to
lower a price. When a change touches the UI, actually look at it:

```bash
pnpm dev:admin   # :5174
```

The app requires auth, so pages behind the layout are not reachable without
signing in. To screenshot one, add a temporary unauthenticated route and
**remove it before committing**:

```tsx
<Route path="/__preview" element={<AdminLayout />}>
  <Route index element={<Dashboard />} />
</Route>
```

## Before claiming done

- No temporary preview route left in `App.tsx`
- No secrets in tracked files (`.env` and `.backups/` are gitignored)
- Pending-vs-applied migration status in `CLAUDE.md` still accurate
- Numbers quoted to the user came from a run you just did, not from memory
