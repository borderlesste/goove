# Goove

React storefront and owner studio, built with Vite and backed by Supabase Auth,
Postgres, Storage, and the `goove-api` Edge Function.

## Development

Use Node 24 and npm (the committed `package-lock.json` is the dependency source
of truth). Copy `.env.example` to `.env.local` and set the public URL and
publishable key of the intended Supabase project:

```sh
npm ci
npm run dev
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in the browser
environment. The Edge Function uses server-side `SUPABASE_SERVICE_ROLE_KEY`.
Local development without configuration shows sample content. Production without
configuration shows an unavailable message instead of a misleading sample catalog.

## Verification

```sh
npx playwright install chromium
npm run check
npm audit --audit-level=moderate
```

`check` verifies formatting, builds the Sites-compatible package, runs the SQL
reward lifecycle and request validation tests, then runs Chromium tests at desktop
and mobile sizes. Browser tests mock Supabase and WhatsApp and never create real
reservations. CI runs these checks on every push to `main`.

## Vercel

`vercel.json` installs with `npm ci`, builds with `npm run build`, publishes
`dist/client`, and maps `/rewards` and `/admin` to the application shell. Missing
assets and API paths remain 404 responses. Add both `VITE_SUPABASE_*` variables
to the desired deployment environments, then deploy again: Vite embeds them during
the build. Unprefixed Supabase integration variables alone do not configure Vite.

## Supabase

All direct browser table access is denied. Public catalog and reward requests go
through the Edge Function; every admin action verifies a live Auth user against
the owner allowlist. RLS without browser policies is intentional for these tables.
Owner invitation emails must be provisioned by a trusted database administrator.

Deploy `goove-api` with its `../_shared/http.ts` dependency and keep
`verify_jwt = false` as defined in `supabase/config.toml`: the catalog is public,
reward actions validate access codes, and admin actions perform their own user and
owner checks. Inspect the target project before any database deployment.

`supabase/schema.sql` is the existing fresh-database bootstrap; the other top-level
SQL files record historical changes and must not be replayed indiscriminately on
production. New reviewed changes live in `supabase/migrations/`. The trigger
permission migration is safe to repeat and leaves automatic RLS enforcement active.

Workflow: work and publish directly on `main`, without worktrees or PRs, per the
repository owner's instruction. Run verification before pushing.
