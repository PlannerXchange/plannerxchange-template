# Advisor App Starter

This template is the first local scaffold for an advisor-owned PlannerXchange app repo.

It is designed to show the minimum v1 publication shape:

- `plannerxchange.app.json`
- a shell-compatible `src/plugin.tsx` entrypoint
- a local preview host that mounts the plugin with mock PlannerXchange runtime context
- a production build that emits a publish manifest mapping the source `entryPoint` to the built artifact PlannerXchange will host
- a GitHub CodeQL workflow that produces the required code-scanning evidence for linked repo branches
- a `plannerxchange/` markdown context pack for AI-assisted student builds

Required publication metadata should live in `plannerxchange.app.json` whenever possible.

Examples:

- `name`
- `slug`
- `framework`
- `visibility`
- `dataPortabilityMode`
- `categories`
- `summary`
- `description`
- optional media URLs

`dataPortabilityMode` is a build-contract choice:

- `plannerxchange_portable`
  - use this when the app uses PlannerXchange canonical data contracts
  - the app should use PlannerXchange APIs and PX-governed data contracts for firm, advisor, client, account, household, or other PX-canonical domains
  - builder-owned work product may still be saved through approved PX app-data APIs
  - this is the preferred default when the app participates in PlannerXchange-governed canonical data contracts

- `app_managed_nonportable`
  - use this when the app's business persistence lives in app-owned or partner-managed systems rather than PX canonical data contracts
  - the app may still use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
  - the app can still publish through PlannerXchange, but its app-owned data is not eligible for the PX portability contract

Important:

- this template does not teach membership-tier or entitlement rules
- `plannerxchange_portable` is an architecture declaration, not a statement about what the current builder account is allowed to enable in the shell
- `plannerxchange_portable` does not mean every PlannerXchange-hosted record becomes canonical or cross-app portable by default
- platform review and product entitlements are handled inside PlannerXchange, not in this repo

## Platform Contract Map

This starter mirrors the high-signal subset of these PlannerXchange builder-spec areas:

- runtime overview
- auth and session
- canonical-data API
- app-data API
- app access and feature entitlements
- branding and legal
- publish requirements

If you have access to the PlannerXchange platform repo, review the corresponding `docs/builder-spec/` files for the full contract.

The template context pack also includes current guidance for:

- household tax reads through household summary fields plus year-scoped tax-filing records
- provider-scoped external identity so households, clients, and accounts can support multiple external mappings over time

## Current status

This starter is self-contained enough to copy into a separate builder repository, including the
`plannerxchange/` markdown files that explain the PX backend contract.

It includes a small local `src/plannerxchange.ts` contract shim so students can start building
without needing extra PlannerXchange packages before they understand the backend rules.

This starter is npm-first and should keep `package-lock.json` committed so installs stay repeatable
across workshop runs, AI-assisted coding sessions, and future CI checks.

The production build emits `dist/plannerxchange.publish.json` and `dist/plannerxchange.build-provenance.json`.

That file maps the manifest's source `entryPoint` such as `src/plugin.tsx` to the built JS module and
any emitted CSS assets that PlannerXchange should host and launch.
The build-provenance file records the source-input digest, lockfile digests, build command,
package manager, and committed artifact digest evidence PlannerXchange verifies before hosting.

## How to start a repo correctly

Use one of these patterns:

1. Use GitHub's template-repo flow from `https://github.com/PlannerXchange/plannerxchange-template`
2. Copy the starter files into the root of a fresh builder-owned repository
3. Export or download the starter and initialize a new builder-owned repo around it

Do not `git clone` this repo into `docs/` or another subfolder inside a separate app repo.

That creates a nested git repository, confuses future coding agents about which repo is the real app,
and turns the starter into reference material instead of the working project.

## Recommended Initial AI Prompt

Use this prompt, then answer the questions the AI asks before it starts writing app code:

```text
I am starting a new app that may be published on PlannerXchange.

Use the PlannerXchange template and markdown docs as backend and publish-contract guidance only, not as frontend design guidance.

Important setup rules:
1. Start from the PlannerXchange template repository itself, or copy its files into the root of this repo.
2. Do not git clone the template into docs/ or any subfolder.
3. Read the plannerxchange markdown files first and treat them as the source of truth for auth, runtime context, API contracts, data persistence, whitelabeling, and publication rules.
4. Do not assume undocumented PlannerXchange API routes exist.
5. Do not copy PlannerXchange visual styling unless I explicitly ask for it.
6. Keep the UI builder-owned and frontend-agnostic unless required by backend, security, or publication rules.
7. All mock data must use obviously synthetic names and @example.test email addresses. Never embed real personal data in source code.
8. Use the shell runtime context to distinguish mock from live behavior. Prefer the starter's `isShellHosted(ctx)` helper and `ctx.authenticatedFetch`; do not gate published behavior on build-time env vars.
9. Route all app-owned record reads and writes through the PX app-data API gateway pattern (see src/lib/px-gateway.ts). Do not use localStorage as a production persistence layer — it is mock-only.
10. Use the current live API route paths documented in plannerxchange/api-reference.md (root-scoped like /households, /clients, /accounts), not the future /canonical/* namespace.
11. Use the default Vite port (5173) for local development — PlannerXchange allows CORS and auth callbacks only from localhost:5173.
12. Keep the `.github/workflows/codeql.yml` workflow enabled. PlannerXchange requires GitHub CodeQL results for the exact linked branch commit before publication.
13. Treat CodeQL findings in PlannerXchange review feedback as security blockers or remediation tasks. Fix the underlying code or workflow issue; do not remove CodeQL, suppress alerts casually, or dismiss alerts without an auditable reason.

Before writing code, ask me these questions and wait for my answers:

1. In a few sentences, describe the app you want to build — what will it do for an advisor or their clients? (Free text.)

2. Will this app be:
   a) Something you only use on your own computer (local-only tool)?
   b) An app you want to share with other advisors through the PlannerXchange marketplace, possibly with your own branding and pricing?
   c) All of the above, plus the ability to read and work with real client data from PlannerXchange?

3. Will your app need to access information PlannerXchange already stores — like client names, household details, account balances, or investment positions? If yes, describe what information your app will use.

4. Will your app need to save its own work product (like questionnaire answers, recommendations, or reports) so it persists across sessions? PlannerXchange can store this for you.

5. Beyond reading client data, will your app also need to add or update information about households or clients? (Note: PlannerXchange may not yet support builder-owned writes for all record types.)

After I answer:

Phase 1 — Build a fully working local app first:
- scaffold the app UI and core logic using mock data from dev-context.ts and the gateway mock mode
- make sure the app works end-to-end locally before wiring any PX API calls
- keep mock data obviously synthetic

Phase 2 — Wire PX integration:
- scaffold only the minimum contract-required PlannerXchange integration
- request only the minimum permission scopes needed for the described app
- clearly distinguish mock mode from real PlannerXchange runtime
- do not claim live PlannerXchange mode unless a real app installation context exists
- set slug, name, summary, description, and categories in plannerxchange.app.json based on the app description I provided — do not ask me to fill those in manually
- use React + TypeScript + Tailwind CSS (Vite) unless I specify otherwise

Identity rules — do not tell me to do any of the following, because PlannerXchange handles them:
- appId is assigned by PlannerXchange during publication, not set by the builder
- appBasename is injected by the PlannerXchange shell at runtime (e.g. /apps/<slug>), not set by the builder
- slug is the only identifier the builder provides in plannerxchange.app.json
- do not tell me to manually update appId or appBasename — they are mock values in dev-context.ts and real values come from PX at runtime
```

## Local development

1. Start from this template at the root of the builder repo.
2. Run `npm install`.
3. Run `npm run dev` — this starts the dev server on `localhost:5173` (Vite default).
4. **Port 5173 is required** — PlannerXchange allows CORS and auth callbacks from `localhost:5173`. Do not change the port.
5. Open the Vite preview and confirm the plugin mounts with the mock shell context from `src/dev-context.ts`.
6. Build your own UI and routes; the default template does not ship a styled frontend starter.
7. Run `npm run build` before publication to generate `dist/`, `dist/plannerxchange.publish.json`, and `dist/plannerxchange.build-provenance.json`.

### Mock vs live mode

By default, local development uses **mock mode** with synthetic data from `dev-context.ts`. This lets you build and test UI without a PlannerXchange account.

To connect to real dev data, your app must run inside the PlannerXchange shell (which injects real auth tokens and installation context). Local development is primarily for frontend iteration with mock data.

The template is intentionally markdown-first:

- the markdown files explain the PX backend contract
- the starter code only provides the minimum plugin and local-preview scaffolding
- students do not need to reason about PlannerXchange package design to start building

Local development modes:

- `mock shell + mock data`
  - the default local preview mode for UI scaffolding and contract familiarization
  - keep sample names and records obviously synthetic
  - do not describe this as live PlannerXchange data
- `mock shell + real PX APIs`
  - only valid when PlannerXchange has supplied a real installation context separately
  - a base URL plus bearer token is not enough by itself for installed-app API behavior
  - hardcoded development `appInstallationId` values are mock fixtures, not live installation context
- `in-shell / installed-app runtime`
  - the contract-true environment for real auth, branding, legal, entitlements, and installation-scoped PX API calls
  - use this mode before claiming an app is truly wired to PlannerXchange

## Student workflow

Recommended workshop flow:

1. student starts a new GitHub repository from this template or copies these files into the repo root
2. student copies `.env.example` to `.env` (mock mode is the default)
3. student reads the `plannerxchange/` markdown files first
4. student uses an AI coding agent against the local repo
5. student builds Phase 1 (local-only app with mock data, using `src/lib/px-gateway.ts` in mock mode)
6. student wires Phase 2 (PX API integration through the gateway's live mode)
7. student runs `npm run build` then `npm run preflight`
8. student commits and pushes source plus the generated `dist/` output
9. student waits for the GitHub CodeQL workflow to complete on the pushed branch
10. student logs into PlannerXchange and links the repository for governed publication

The intended UI should require little more than the GitHub URL. PlannerXchange should read the
required metadata from `plannerxchange.app.json` and only ask for optional merchandising overrides
when needed.

## Builder checklist

- Keep `plannerxchange.app.json` aligned with `src/plugin.tsx`.
- Keep `entryPoint` source-oriented, such as `src/plugin.tsx`; do not replace it with a hashed build file.
- Run `npm run build` before publish and commit the generated `dist/` output, including the publish manifest and build-provenance file.
- Run `npm run preflight` after building to catch common rejection issues before submitting.
- Keep `.github/workflows/codeql.yml` committed and wait for CodeQL to pass on the branch commit before requesting PlannerXchange review.
- Do not hand-edit `dist/plannerxchange.publish.json` or `dist/plannerxchange.build-provenance.json`; let the build regenerate them.
- Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls. Do not manually attach bearer tokens or pass `appInstallationId` in query strings.
- Declare the correct `dataPortabilityMode` before linking the repo.
- Do not add app-owned login flows.
- Route app-owned record reads and writes through the PX gateway pattern (`src/lib/px-gateway.ts`). Do not use `localStorage` as a production persistence layer.
- All mock data must use obviously synthetic names and `@example.test` email addresses. Never embed real personal data in source code.
- Assume PlannerXchange owns auth, tenant resolution, branding, and disclosures.
- Do not add app-owned invite links, email-verification flows, password-setup flows, password-reset flows, or onboarding entry flows.
- Configure your router `basename` to the `appBasename` value from the shell context props (`/apps/<your-app-slug>`). Use `BrowserRouter` (or Vue Router with `createWebHistory`) — not `MemoryRouter` — so deep links and browser history work correctly.
- Do not add auth routes, sign-in pages, or routes outside your `/apps/<appSlug>` prefix.
- Initialize your router at the `initialPath` context prop so deep links land on the correct view.
- If the app renders branded chrome, inherit logo, favicon, primary color, secondary color, and font color from PlannerXchange runtime context instead of hardcoding one static brand.
- If the app does not render app-owned branded chrome, do not request `branding.read` just because the starter demonstrates branding fields.
- If the app does not render app-owned disclosure text or links, do not request `legal.read` just because the starter demonstrates legal context.
- Use PlannerXchange APIs and canonical contracts for PX-governed data.
- Save builder-owned work product such as scenarios, recommendations, questionnaire responses, and projections through approved PX app-data APIs or explicit app-owned persistence.
- Treat `firmId` as the maximum data boundary for PX canonical data. Stricter intra-firm scoping is fine; broader scope is not.
- If the app is nonportable, it may still read approved PX canonical data through PX APIs by default.
- If the app is intentionally nonportable, be explicit about that and avoid requesting PX-canonical scopes you do not need.
- Do not treat immutable PX reference facts as app-writable just because the app can read them.
- Keep requested permission scopes minimal.
- If the app shows a logo, size it responsively because different firms may upload different logo proportions.
- Do not commit machine-local absolute filesystem links in markdown; use repo-relative links only.
- Do not treat the template as frontend direction; the default starter intentionally ships no styled UI.

Auth lifecycle reminder:

- PlannerXchange owns founder onboarding, invited-advisor onboarding, and future invited-client onboarding.
- PlannerXchange may send private-labeled invitation emails on behalf of a firm, but those identity emails are platform-owned, not app-owned.
- If a user reaches your plugin, assume the shell already handled sign-in, invite redemption, email verification policy, and initial password choice.

## Files

- `plannerxchange.app.json`: publish manifest
- `plannerxchange.preflight.json`: machine-readable preflight checklist
- `.github/workflows/codeql.yml`: required GitHub CodeQL code-scanning workflow
- `plannerxchange/app-brief.md`: the student-facing project brief
- `plannerxchange/api-reference.md`: HTTP conventions and current builder-facing route matrix
- `plannerxchange/app-access.md`: app-access and entitlement context
- `plannerxchange/app-data-api.md`: builder-owned work-product persistence contract
- `plannerxchange/branding-and-legal-api.md`: whitelabel branding and disclosure contract
- `plannerxchange/context.md`: platform constraints and design reminders
- `plannerxchange/data-contract.md`: current PX canonical data, portability, and auth assumptions
- `plannerxchange/email-api.md`: outbound transactional email contract
- `plannerxchange/pii-and-security.md`: data-classification and restricted-PII handling rules
- `plannerxchange/publish-notes.md`: publication and review expectations
- `src/plugin.tsx`: PlannerXchange plugin entrypoint
- `src/main.tsx`: local preview host
- `src/dev-context.ts`: mock runtime context for local development
- `src/lib/px-gateway.ts`: mock/live API gateway pattern for PX API calls
- `.env.example`: environment variable template (copy to `.env`)
- `scripts/preflight.mjs`: pre-publish validation script
- `dist/plannerxchange.publish.json`: generated publish manifest that maps source `entryPoint` values to built artifact files
- `dist/plannerxchange.build-provenance.json`: generated build evidence that binds source inputs, lockfiles, build command, and committed artifact digests

## Scope

This repository should stay intentionally small:

- starter code only
- `plannerxchange/` markdown pack
- one strong README

Do not mirror the full platform docs tree into the student repo. The template should carry the
high-signal subset students and their coding agents actually need.

This repository is the public builder starter only. Internal platform architecture, persistence,
security, KMS, infrastructure, and runbook docs remain private in `plannerxchange-platform` and are
not duplicated here.
