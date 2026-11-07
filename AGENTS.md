# Prototype Instructions

Repository workflow: work directly on `main`. Do not create worktrees, feature branches, or pull requests. Verify changes before pushing to `main`.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Prototype preferences: In Admin → Codes, keep the dedicated promo-code refresh control directly below “Each promo code can be selected once. Pause a code to remove it from the customer list.” Keep access-code refresh separate. Promo-code refresh must ask for confirmation, change the code while keeping the promotion listed for customers, and preserve the selection identifier. Every active promotion must appear in the public gift catalog and have one available promo code; show already-selected codes in the customer list as unavailable instead of removing them. Create a code automatically when a promotion is created or reactivated. Customers with a verified access code can refresh the available-code list without gaining another selection. Refreshing an access code must not change promo-code status. In Admin → Gifts, provide a direct way to hide and reactivate each promotion; hidden promotions stay out of both customer-facing gift and promo lists. In Admin → Settings, allow the owner to manage the public phone number, email address, and social media links shown on the customer-facing site. Let the owner upload 1–3 ordered photos for each handbag and gift, and use consistent, standard photo frames and readable text sizes on Rewards.
