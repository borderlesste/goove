---
name: dev-toolkit
description: Use Goove's installed Ponytail, ECC, and Agency Agents tools for development, reviews, testing, accessibility, API work, and deployment. Also use when asked about these tools or to restore their full source catalogs.
---

# Goove development toolkit

Read the project's `AGENTS.md` and `docs/dev-tools/README.md` before choosing a
workflow. The owner's instruction to work directly on `main`, without worktrees
or PRs, takes precedence over third-party examples.

1. Use Ponytail for the smallest complete implementation and focused reviews.
2. Select the matching ECC skill for React, APIs, accessibility, migrations,
   testing, or verification. Use Goove's actual commands, documented below.
3. Select an `agency-*` skill when a specialist perspective helps. Apply that
   perspective in the current session. Merely loading a profile does not start
   another agent. Delegate only when the user or another applicable instruction
   explicitly authorizes delegation.
4. Read only the selected skill's `SKILL.md` and its needed references. Keep the
   existing React/Vite stack and connected GitHub, Supabase, and Vercel tools.
5. Verify using `npm run check`, `npx deno task --cwd supabase/functions check`,
   and relevant connected-service checks when needed. Do not invent coverage
   figures or run commands for frameworks Goove does not use.

Installed skills and Agency Codex profiles are committed to the project and work
without a source cache. `dev-tools.lock.json` pins the user's three forks.
`dev-tools.installed.json` records source revisions and installed file hashes.

To access another skill or profile from the full libraries, run
`npm run tools:setup` if the cached source is absent, then read the matching file
under `work/dev-tools/sources/<id>-<revision>/`. The setup prints exact revisions;
read `dev-tools.lock.json` rather than guessing paths. Source libraries remain
separate from the storefront runtime. Run `npm run tools:check` to check integrity.
