# Prototype Instructions

Repository workflow: work directly on `main`. Do not create worktrees, feature branches, or pull requests. Verify changes before pushing to `main`.

Account policy: the first registered, non-anonymous email account receives
administrator membership automatically. Require email confirmation before owner
API access. Later accounts need an explicit owner invitation. Keep the initial
administrator decision closed after user deletion or access revocation. Supabase
Auth owns account credentials in `auth.users`; owner permissions use
`public.goove_owners`.

Email confirmation must return to `https://goove.vercel.app/`. Keep signup's
`emailRedirectTo`, Supabase Auth Site URL, and the exact redirect allowlist aligned.
Show success only after a confirmed identity is verified by Supabase Auth.

Storefront design: use a compact split hero with text on the left and proportional
photography on the right; stack on mobile. Heading: “Elevate Your Elegance”.
Subtitle: “Luxury Women's Handbags with Exclusive Matching Gift”. Use Playfair
Display headings, Inter body text, and restrained Cinzel accents. Keep product
cards equal height with purchase actions aligned, expandable descriptions, and
image-triggered accessible Quick View. Keep the gift promotion visible across
routes and scrolling as an animated ribbon in a sticky top strip, with reduced
motion support and no obstruction of product actions. Descriptions must follow
product names immediately, without reserved extra title lines. WhatsApp inquiries
must include a canonical link that opens the exact bag and selected photo in
Quick View, plus the direct public image URL. Show only verified
owner-entered specifications; never invent materials or dimensions.
Keep the hero near its previous 360–380px desktop height (180px image on mobile),
with photography filling the frame vertically and tighter space above the hero.
with a dense collection of five columns on wide screens and two on phones.
Use smaller product images and tight card spacing; avoid reserved empty blocks
between description and price. Do not show a fallback request for materials,
dimensions, or gift details: those belong in the product descriptions.

The gift flag always goes to `/#collection`; “Discover your exclusive rewards”
goes to `/rewards`. Keep the description-to-price gap compact without shrinking
product photography or text. Galleries support 1–10 ordered photos for bags and
gifts, with previous/next arrows in Quick View. Access codes authorize one promo
selection and cannot reopen the selection flow after use. Only an identical
reservation receipt can retry the original request; the saved on-screen claim
can be resent to WhatsApp without another reservation. Refresh access independently
of promo inventory. Serialize competing selections and rotate to a never-issued
code inside the same database transaction.

## Development tools

Ponytail, ECC, and Agency Agents are installed as project-local skills in
`.agents/skills/`. Nine Agency profiles are also available in `.codex/agents/`.
Start with `.agents/skills/dev-toolkit/SKILL.md` and `docs/dev-tools/README.md`
when selecting a development workflow. Read only the relevant skill or profile.
Use the existing React/Vite stack, npm commands, and connected service tools;
third-party examples do not override this repository's workflow or user requests.
Loading an Agency profile does not authorize automatic delegation or parallel work.
Use `npm run tools:check` to verify the installed files and `npm run tools:setup`
to restore the pinned full source catalogs under `work/dev-tools/`.

## Prototype

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Prototype preferences: In Admin → Codes, keep the dedicated promo-code refresh control directly below “Each promo code can be selected once. Pause a code to remove it from the customer list.” Keep access-code refresh separate. Promo-code refresh must ask for confirmation, change the code while keeping the promotion listed for customers, and preserve the selection identifier. Every active promotion must appear in the public gift catalog and have one available promo code; show already-selected codes in the customer list as unavailable instead of removing them. Create a code automatically when a promotion is created or reactivated. Customers with a verified access code can refresh the available-code list without gaining another selection. Refreshing an access code must not change promo-code status. In Admin → Gifts, provide a direct way to hide and reactivate each promotion; hidden promotions stay out of both customer-facing gift and promo lists. In Admin → Settings, allow the owner to manage the public phone number, email address, and social media links shown on the customer-facing site. Let the owner upload 1–10 ordered photos for each handbag and gift, and use consistent, standard photo frames and readable text sizes on Rewards.
