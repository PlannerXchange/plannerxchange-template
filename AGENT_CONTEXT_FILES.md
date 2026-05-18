# Agent Context File Set

The public `plannerxchange-template` repository is a PlannerXchange AI-agent governance context pack with optional starter files.

It should contain exactly this maintained set:

- `.env.example`
- `.gitignore`
- `AGENTS.md`
- `AGENT_CONTEXT_FILES.md`
- `README.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `plannerxchange.app.json`
- `plannerxchange.preflight.json`
- `tsconfig.json`
- `vite.config.ts`
- `plannerxchange/ai-index.md`
- `plannerxchange/app-brief.md`
- `plannerxchange/api-reference.md`
- `plannerxchange/app-access.md`
- `plannerxchange/app-data-api.md`
- `plannerxchange/branding-and-legal-api.md`
- `plannerxchange/context.md`
- `plannerxchange/data-contract.md`
- `plannerxchange/email-api.md`
- `plannerxchange/pii-and-security.md`
- `plannerxchange/publish-notes.md`
- `scripts/preflight.mjs`
- `src/App.tsx`
- `src/dev-context.ts`
- `src/lib/px-gateway.ts`
- `src/main.tsx`
- `src/plannerxchange.ts`
- `src/plugin.tsx`

Keep this repo intentionally small.

The file set is intentionally minimal:

- markdown-first PlannerXchange governance and backend contract guidance
- a thin local runtime-contract shim
- optional scaffold files for builders who want a Vite/plugin baseline
- no default frontend design system

This repo is npm-first. Commit `package-lock.json` so workshop installs, AI-assisted debugging, and CI validation resolve the same dependency tree by default.

Generated build output is intentionally not checked into the context pack by default. Before PlannerXchange publication, builders should run the production build in their own app repo and commit the resulting `distRoot` directory, including `<distRoot>/plannerxchange.publish.json` and `<distRoot>/plannerxchange.build-provenance.json`.

Do not copy:

- the platform monorepo root files
- internal architecture docs
- CDK or API code
- unrelated package workspace config

The public context pack is not the builder app source of truth. Builder-owned repositories remain the working app repos reviewed by PlannerXchange.
