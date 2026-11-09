# Goove

React storefront and owner studio, built with Vite and backed by Supabase Auth,
Postgres, Storage, and the `goove-api` Edge Function.

Development assistance: [Ponytail, ECC, and Agency Agents](docs/dev-tools/README.md)
are installed as project-local skills and Codex profiles, with pinned source
revisions and an offline integrity check.

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

## Product collections and home visibility

The public navigation links to Home, Watches (`/watches`), Handbags (`/handbags`)
and Gifts & Rewards. Watches lead with women’s styles and a separate selection
of men’s watches. Collection pages show all products of their category; the home
page shows every product by default. Uncheck **Show on home page** to keep a
product only in its shop collection.

In **Admin → Handbags/Watches → Add/Edit**, choose the product collection,
Women/Men audience, and **Show on home page**. Add a price and 1–3 photos as
before. Existing IDs, galleries, stock controls and shared links are preserved;
the existing `handbags` storage table now carries category/audience/featured
fields for both types of product. Reward gifts remain separate from sale stock.

The home-visibility update restores the existing catalog to Home once and makes
new products visible by default. Reapplying it preserves later owner exclusions. Existing product-specific descriptions remain
unchanged; shared copy now covers watches and handbags in all four languages.

## Storefront

The site uses Inter throughout, with bold headings, stronger controls and
high-contrast sans-serif body text. The
collection keeps equal-height cards and aligned purchase actions, including when
descriptions expand. Selecting a product image opens an accessible Quick View
with the original gallery photos, full description, availability, and price.
Photos have no Quick View badge; compact 30px arrows keep the image clear.

The home banner uses an 8:5 frame and fits the entire photo without cropping.
Recommended upload: 1600 × 1000 pixels, JPG/PNG/WebP under 5 MB. Other aspect
ratios are accepted with space around the image. Admin → Settings previews the
same frame.

The header language selector offers English, French, Haitian Creole and Spanish
and remembers the visitor’s choice. Shop controls and the Rewards flow are
translated. Under **Admin → Handbags/Gifts → Edit → Language translations**,
owners can translate names, descriptions and handbag specifications. Under
**Admin → Settings → Language translations**, they can translate the banner and
promo flag. Empty translations use the original copy. Owner Studio remains in
English; language switching never changes stored product IDs, codes or photos.

Owners can add verified specifications under **Admin → Handbags → Edit →
Specifications** (up to 1,500 characters). Product descriptions can include
materials, dimensions, and gift details; empty specifications add no contact
prompt. WhatsApp inquiries from
cards and Quick View include a canonical link that opens the exact bag and
selected gallery photo in Quick View, plus the direct public image URL.
Previously shared `#bag-…` links still scroll to their product card.
WhatsApp receives image links in the inquiry
text; the website does not upload attachments or send messages automatically.

The gift promotion is a ribbon in a sticky top strip. It stays visible while
scrolling and navigating between pages without floating over purchase actions.
Its shimmer and hover effects respect reduced-motion preferences.

The gift flag leads to `/#collection`; both “Discover your exclusive rewards”
links lead to `/rewards`. Owners can upload 1–3 ordered photos per bag or gift.
Quick View includes previous/next arrows, a photo count, and direct sharing of
the selected image.

An access code is consumed by one successful selection and cannot reopen the
flow after use. A random client receipt becomes the claim ID, so retrying the
same reservation returns its original result without another allocation. Different
receipts or selections cannot reuse the access code. The saved browser view can
resend WhatsApp without reserving again. The existing RPC's `p_reference` parameter
carries this receipt; purchase reference text still comes from the access record.

The database locks the settings, access row and selected promotion consistently.
Competing customers wait and receive different promo values. Historical selected
values stay unique, and refreshing access never rotates promo inventory. The
migration changes one existing function; it adds no tables, columns, or privileges.

Refreshing access updates only the displayed code and access-code history. On
older API deployments the app reads the admin snapshot but merges only its access
history, leaving promo inventory and the public catalog untouched.

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

Accounts created from `/admin` are sent directly to Supabase Auth through
`supabase.auth.signUp`. Supabase stores identities, emails, and password hashes
in **`auth.users`**; inspect them under **Authentication → Users** in the Supabase
dashboard. The Auth schema is deliberately excluded from the public Data API.
Do not duplicate credentials in a `public.users` table.

### Email confirmation

The public return URL is **`https://goove.vercel.app/`**, including the trailing
slash. Signup and confirmation resend use this fixed URL, rather than the domain
of a local or preview deployment. The landing page handles expired/invalid links
and shows confirmation only after Supabase validates a confirmed identity. It
removes callback details from the displayed URL; it never grants owner access.
The owner API still requires confirmed email and owner membership.

In [Authentication → URL Configuration](https://supabase.com/dashboard/project/kjvtlelsqtnwiotnxaji/auth/url-configuration),
set **Site URL** to `https://goove.vercel.app/` and add the exact same URL to
**Redirect URLs**. Remove obsolete production aliases after checking whether any
other clients still use them. Avoid production wildcard redirects. In the
confirmation email template, keep the verification link as
`<a href="{{ .ConfirmationURL }}">Confirm your email</a>` so Supabase verifies the
token before returning to Goove. A bare Site URL does not confirm an account.

`supabase/config.toml` records these intended Auth URLs. Committing that file does
**not** change hosted Auth settings. The connected Supabase MCP tools do not expose
Auth configuration; use the dashboard or a narrowly scoped Management API update.
Do not push the entire local configuration to production just to change two URLs,
because unspecified Auth settings could also be affected.

For a real delivery check, create an account under `/admin`, open the latest
confirmation email, and verify that the final page is the canonical root with a
confirmation message. Continue to owner access, then test re-opening the same
link and using **Resend confirmation email** with an unconfirmed account. Browser
tests mock Auth and do not send email. A safe invalid-token probe should redirect
to the canonical root with an expired-link message. Check both the default return
and an explicit `redirect_to`; an unapproved external destination must also fall
back to Goove. Hosted Auth URLs must be verified independently of the deployment.

The first non-anonymous email account automatically receives a row in
`public.goove_owners` through an Auth signup trigger. Its email must be confirmed
before the owner API grants access. Subsequent users require an explicit invitation
in `public.goove_owner_invitations`, provisioned by a trusted administrator.
User-editable metadata never assigns owner privileges.

`goove_private.initial_administrator` records the one-time bootstrap decision.
Its singleton primary key arbitrates simultaneous signups; deleting the initial
user or revoking its owner row does not reopen setup. The bootstrap migration
seeds the earliest existing email account and preserves other existing owners.
An administrator who loses access must recover it through a trusted database
administrator rather than creating another account to reclaim ownership.

Deploy `goove-api` with its `../_shared/http.ts` and `../_shared/owner.ts` dependencies and keep
`verify_jwt = false` as defined in `supabase/config.toml`: the catalog is public,
reward actions validate access codes, and admin actions perform their own user and
owner checks. Inspect the target project before any database deployment.

`supabase/schema.sql` is the existing fresh-database bootstrap; the other top-level
SQL files record historical changes and must not be replayed indiscriminately on
production. New reviewed changes live in `supabase/migrations/`. The trigger
permission migration is safe to repeat and leaves automatic RLS enforcement active.
For a new database, apply the bootstrap schema and then the incremental migrations
in version order. Existing production databases must receive only their pending
migrations; do not replay the bootstrap schema.

Workflow: work and publish directly on `main`, without worktrees or PRs, per the
repository owner's instruction. Run verification before pushing.

Product display order is shuffled in the browser on refresh and after returning
from five minutes away. It stays steady during active browsing, language changes
and route changes. An open modal defers the return shuffle until it closes.
Featured selection, women/men sections, saved display order, owner inventory and
reward codes are unaffected. Images and product titles open shared Quick View.
