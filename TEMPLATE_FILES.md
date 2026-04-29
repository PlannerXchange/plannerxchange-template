# Template File Set

The public `plannerxchange-template` repository should contain exactly this starter set:

- `.env.example`
- `.gitignore`
- `.github/workflows/codeql.yml`
- `README.md`
- `TEMPLATE_FILES.md`
- `index.html`
- `package-lock.json`
- `package.json`
- `plannerxchange.app.json`
- `plannerxchange.preflight.json`
- `tsconfig.json`
- `vite.config.ts`
- `plannerxchange/app-brief.md`
- `plannerxchange/context.md`
- `plannerxchange/data-contract.md`
- `plannerxchange/publish-notes.md`
- `scripts/preflight.mjs`
- `src/App.tsx`
- `src/dev-context.ts`
- `src/lib/px-gateway.ts`
- `src/main.tsx`
- `src/plannerxchange.ts`
- `src/plugin.tsx`

Keep the public template repo intentionally small.

The file set is intentionally minimal:

- markdown-first backend contract guidance
- a thin local runtime-contract shim
- no default frontend design system

This starter is npm-first. Commit `package-lock.json` so workshop installs, AI-assisted debugging,
and CI validation resolve the same dependency tree by default.

Generated build output is intentionally not checked into the starter by default.
Before PlannerXchange publication, builders should run the production build and commit the resulting
`dist/` directory, including `dist/plannerxchange.publish.json`.

Do not copy:

- the platform monorepo root files
- internal architecture docs
- CDK or API code
- unrelated package workspace config

The template repo should be a standalone student starter, not a mirror of the platform repo.
