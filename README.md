# PlannerXchange AI Agent Governance Context Pack

This repository is the public PlannerXchange context pack for AI agents building advisor-owned apps in builder-owned repositories.

Use it to teach an AI coding agent the PlannerXchange shell runtime, manifest, data, security, and review rules before it edits app code. The minimal scaffold remains available as an optional reference when a builder wants a Vite/plugin baseline.

It documents the minimum v1 publication shape:

- `plannerxchange.app.json`
- a shell-compatible `src/plugin.tsx` entrypoint
- a local preview host that mounts the plugin with mock PlannerXchange runtime context
- a production build that emits a publish manifest mapping the source `entryPoint` to the built artifact PlannerXchange will host
- `AGENTS.md` and `plannerxchange/ai-index.md` so student AI builder agents can find the right contract before editing
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

Do not create inferred capability fields from review output.

PlannerXchange review may say it detected capabilities such as marketplace distribution, portable data, demo mode, or landing-page readiness. Those are review/eligibility labels, not manifest keys. Do not add `capabilities`, `marketplace`, `portableData`, `demoMode`, `demoModeEnabled`, `supportsDemoMode`, `landingPage`, `landing_page`, `publicLandingPage`, `landingPageEnabled`, or `supportsLandingPage` to `plannerxchange.app.json`.

Use the actual manifest fields instead:

- marketplace intent: `"visibility": "marketplace_listed"`
- portable-data intent: `"dataPortabilityMode": "plannerxchange_portable"`
- nonportable/demo/enterprise-exception posture: `"dataPortabilityMode": "app_managed_nonportable"`
- data/API access: exact scope strings in `"permissions"`
- external hosts: `"egressDeclarations"`
- CSV/file/API ingress: `"dataIngressDeclarations"`

Demo mode and public landing pages are enabled from PlannerXchange after review eligibility. They are not currently builder manifest fields.

`canonicalDataUsageDeclarations` is a supported manifest field only for apps
that represent canonical data in Demo mode. It pins exact object/field usage to
`px_canonical_demo_v1`; it does not declare or enable Demo mode. See
`plannerxchange/canonical-demo-data.md`.

`dataPortabilityMode` is a build-contract choice:

- `plannerxchange_portable`
  - use this when the app uses PlannerXchange canonical data contracts
  - the app should use PlannerXchange APIs and PX-governed data contracts for firm, advisor, client, account, household, or other PX-canonical domains
  - builder-owned work product may still be saved through approved PX app-data APIs
  - this is the preferred default when the app participates in PlannerXchange-governed canonical data contracts

- `app_managed_nonportable`
  - use this when the app is demo/external-showcase oriented, uses only app-owned non-PX data, or has a separately approved enterprise exception
  - the app may still use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
  - this is not permission to store PX/client/subscriber data in a builder-owned database, storage service, service-role backend, or other app-managed backend
  - the app can still publish through PlannerXchange, but its app-owned data is not eligible for the PX portability contract

Important:

- this template does not teach membership-tier or entitlement rules
- `plannerxchange_portable` is an architecture declaration, not a statement about what the current builder account is allowed to enable in the shell
- `plannerxchange_portable` does not mean every PlannerXchange-hosted record becomes canonical or cross-app portable by default
- shell-published self-serve apps are default-deny for builder-owned subscriber-data backends and third-party API egress of PX/client data
- shell-published apps do not run builder-authored Python, server-side functions, containers, scheduled jobs, or background workers at runtime; Python is local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path
- external AI/search/provider calls such as Tavily, OpenAI, Anthropic, Gemini, analytics, support, or vendor APIs are not non-enterprise self-serve exceptions; `egressDeclarations` document the request but do not approve PX/client data leaving the shell
- CSV/file imports must be declared; high-risk client/account/custodian CSVs must use declared PX import sessions (`px_import_session` + `ctx.openDataImportSession`), not app-owned parsers, import routes, or parent-matching logic. Every Import Data route, navigation item, page, or primary action must launch the matching PX session immediately or through its primary action; informational-only terminal pages are prohibited. Only a transient launching state or recoverable error may remain in app UI. Statically traceable local wrappers and configured `tsconfig`/`jsconfig` path aliases are supported when they resolve uniquely, though the direct runtime-helper call is the recommended simplest pattern. `openDataImportSession({ declarationId, mode: "canonical_store" })` returns only `{ mode: "canonical_store", status: "launched" }`; do not wait for completed-result fields. If TypeScript says `openDataImportSession` is missing, refresh `src/plannerxchange.ts` from the current template before changing the app architecture.
- canonical creates, updates, and soft-deletes must use governed PlannerXchange canonical APIs with matching `canonical.*.write` scopes; app-data remains for app-owned work product
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

For AI coding agents, start with `AGENTS.md` and `plannerxchange/ai-index.md`. The index maps review phrases such as `Portable data`, `Marketplace distribution`, `Demo mode`, and `Landing page` to the actual manifest fields and docs.

If you have access to the PlannerXchange platform repo, review the corresponding `docs/builder-spec/` files for the full contract.

The template context pack also includes current guidance for:

- canonical household, client, and account controls, including PX-backed selection, governed `Add new`, stable IDs, and app-local naming boundaries
- household tax reads through household summary fields plus year-scoped tax-filing records
- provider-scoped external identity so households, clients, and accounts can support multiple external mappings over time
- public landing pages as an optional review mode with PlannerXchange-owned CTA, auth, install, checkout, review, follow, and demo handoffs

## Current status

This context pack is self-contained enough for an AI agent to read by URL or for a builder to copy into a separate builder repository. The `plannerxchange/` markdown files explain the PX backend contract.

It includes a small local `src/plannerxchange.ts` contract shim so students can start building
without needing extra PlannerXchange packages before they understand the backend rules.

The optional scaffold is npm-first and should keep `package-lock.json` committed so installs stay repeatable
across workshop runs, AI-assisted coding sessions, and CI checks.

The production build emits `<distRoot>/plannerxchange.publish.json` and `<distRoot>/plannerxchange.build-provenance.json`.

That file maps the manifest's source `entryPoint` such as `src/plugin.tsx` to the built JS module and
any emitted CSS assets that PlannerXchange should host and launch.
The build-provenance file records the source-input digest, lockfile digests, build command,
package manager, and committed artifact digest evidence PlannerXchange verifies before hosting.
Published artifacts are not served from the shell domain root. Keep Vite `base: "./"` and import static
assets from source modules so the build emits app-relative asset URLs instead of `/assets/...` paths.

The default app folder is the repository root:

- `appRoot`: `.`
- `distRoot`: `dist`
- `entryPoint`: `src/plugin.tsx`, resolved relative to `appRoot`

Most builders should keep those defaults. Larger repositories and monorepos may
declare a repo-relative `appRoot`, a repo-relative `distRoot`, and an optional
`workspacePackage` in `plannerxchange.app.json`. The starter build and preflight
scripts read those fields and emit publish/provenance files under `distRoot`.

## How to start a repo correctly

Use one of these patterns:

1. Point the coding agent at `https://github.com/PlannerXchange/plannerxchange-template` and tell it to treat this repo as PlannerXchange governance context.
2. Work in the builder-owned app repository that will be linked to PlannerXchange.
3. Copy the optional starter files into the app repo root only if the repo needs a shell-plugin baseline.
4. Export or download the scaffold and initialize a new builder-owned repo around it only when starting from scratch.

Do not `git clone` this repo into `docs/` or another subfolder inside a separate app repo.

That creates a nested git repository, confuses coding agents about which repo is the real app,
and turns the context pack into embedded reference material instead of clear governance context.

## Recommended Initial AI Prompt

Use this prompt, then answer the questions the AI asks before it starts writing app code:

```text
I am starting a new app that may be published on PlannerXchange.

Use the PlannerXchange template and markdown docs as backend and publish-contract guidance only, not as frontend design guidance.

Important setup rules:
1. Treat https://github.com/PlannerXchange/plannerxchange-template as PlannerXchange governance context first. Work only in my builder-owned app repo unless I explicitly ask you to maintain the context pack.
2. Do not git clone the template into docs/ or any subfolder.
3. Read the plannerxchange markdown files first and treat them as the source of truth for auth, runtime context, API contracts, data persistence, whitelabeling, and publication rules.
4. Do not assume undocumented PlannerXchange API routes exist.
5. Do not copy PlannerXchange visual styling unless I explicitly ask for it.
6. Keep the UI builder-owned and frontend-agnostic unless required by backend, security, or publication rules.
7. All mock data must use obviously synthetic names and @example.test email addresses. Never embed real personal data in source code.
8. Use the shell runtime context to distinguish mock from live behavior. Prefer the starter's `isShellHosted(ctx)` helper and `ctx.authenticatedFetch`; do not gate published behavior on build-time env vars.
9. Route all app-owned record reads and writes through the PX app-data API gateway pattern (see src/lib/px-gateway.ts). Do not use localStorage as a production persistence layer — it is mock-only.
10. If you select `demo_mode`, read `plannerxchange/demo-mode.md`. Branch on `isPublicDemo(ctx)` before authenticated initialization, start with synthetic data already loaded, skip end-client identity/file intake, and do not fetch or persist anything from the public path.
11. For client-, household-, or account-linked app-data records, set top-level `clientUserId`, `householdId`, `accountId`, or `sourceRefs`. A `clientId` inside `payload` is not enough for PlannerXchange governance, filtering, export, lifecycle, or support workflows.
12. Use the API route paths documented in plannerxchange/api-reference.md (root-scoped like /households, /clients, /accounts).
13. Use the default Vite port (5173) for local development — PlannerXchange allows CORS and auth callbacks only from localhost:5173.
14. Treat PlannerXchange CodeQL findings in review feedback as security blockers or remediation tasks. Fix the underlying code issue and push a new commit. PlannerXchange owns CodeQL execution.
15. Do not add builder-owned databases, service-role keys, database URL env vars, or direct integration-provider API clients for PX/client/subscriber data. Use PX canonical APIs and PX app-data instead.
16. If the app accepts CSV or file uploads, declare the ingress in plannerxchange.app.json. Use only the exact documented source, target, and data-class values. App-owned low-risk CSV work product may go to PX app-data; high-risk client/account/custodian CSV imports must use `target: "px_import_session"` and `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })`. Every import-facing route or control must reach that matching helper in source and committed build output. PlannerXchange handles upload, suggested field mapping, skipped fields, user confirmation, validation, audit, and canonical import. The handoff is launch-only and returns `{ mode: "canonical_store", status: "launched" }`; after the user returns, refresh through approved canonical read APIs.
17. If Demo mode represents canonical data, use `@plannerxchange/demo-data`, pin a literal scenario and `px_canonical_demo_v1`, and declare every exact object/field use in `canonicalDataUsageDeclarations`. Custom fields are excluded.
18. Before editing plannerxchange.app.json from review feedback, read plannerxchange/ai-index.md and map review capability labels to actual manifest fields. Do not add guessed fields like capabilities, portableData, marketplace, demoMode, demoModeEnabled, supportsDemoMode, landingPage, landing_page, publicLandingPage, landingPageEnabled, or supportsLandingPage.
18. Before fetching review feedback, use the app outcome I already stated. If it is unclear, ask what I want in plain language: try it privately; list it for other advisors; let anyone try a sample using made-up information; show a public information page; match each firm's branding; use PlannerXchange information; or check every outcome. Do not show me internal goal IDs or platform jargon unless I ask. Internally map my answer to draft, marketplace, demo_mode, landing_page, private_label, data_persistence, or all, then run px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown. The goal filters the latest full-review feedback; it does not start or rerun review. If the command exits 2, fix only the current required fix group, rebuild, commit, push, and watch again. If it exits 0, no required fixes remain for that outcome on the reviewed commit.
19. Do not add runtime Python, Flask/FastAPI, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, or subprocess calls for shell-published behavior. If the app needs live server-side Python, stop and ask PlannerXchange which governed product lane applies.
20. Before adding a field named Client, Household, or Account, read plannerxchange/canonical-entity-controls.md. Use PX-backed search/selection and stable canonical IDs. Offer Add new only with the matching canonical write scope and declaration. If the value is app-local, use a distinct label such as Scenario participant.

Before writing code, ask me these questions and wait for my answers:

1. In a few sentences, describe the app you want to build — what will it do for an advisor or their clients? (Free text.)

2. Will this app be:
   a) Something you only use on your own computer (local-only tool)?
   b) An app you want to share with other advisors through the PlannerXchange marketplace, possibly with your own branding and pricing?
   c) All of the above, plus the ability to read and work with real client data from PlannerXchange?

3. Will your app need to access information PlannerXchange already stores — like client names, household details, account balances, or investment positions? If yes, describe what information your app will use.

4. Will your app need to save its own work product (like questionnaire answers, recommendations, or reports) so it persists across sessions? PlannerXchange can store this for you.

5. Beyond reading client data, will your app also need to create, update, or soft-delete shared PlannerXchange canonical records such as households, clients, accounts, tax filings, or integration links?

6. Do you want a public PlannerXchange landing page for this app? If yes, I will read `plannerxchange/landing-page.md`, keep it public-safe, use only synthetic data in screenshots and fixtures, allow only YouTube or Vimeo video embeds, and route sign in, sign up, install, checkout, review, follow, and demo actions through PlannerXchange-owned handoffs.

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
- appBasename, shellAppBasename, and navigate are injected by the PlannerXchange shell at runtime, not set by the builder
- slug is the only identifier the builder provides in plannerxchange.app.json
- do not tell me to manually update appId, appBasename, shellAppBasename, or navigate; they are mock values in dev-context.ts and real values come from PX at runtime
```

## PX CLI feedback loop

PlannerXchange review starts from the GitHub push webhook. The CLI does not publish, deploy, mutate repo links, change pricing, or access canonical data.

Builder agents should use `plannerxchange/ai-index.md` as the routing reference for PlannerXchange commands, review feedback, manifest fields, and SDK/runtime capabilities.

Prerequisites:

- PlannerXchange has provided the `px` CLI install path.
- The builder is a PlannerXchange user with Creator Studio access to the linked repo.
- The app repo is connected through the PlannerXchange GitHub App.
- The local terminal is inside the builder-owned app repo, not inside this context-pack repo.

Login is a one-time browser PKCE flow for the local machine. The CLI discovers the public PlannerXchange login configuration for the selected environment; users do not need a Cognito client id.

```bash
px login --env dev
```

Use `--env prod` only when PlannerXchange tells you the app should use the production shell and review pipeline. Creator Studio's "Copy CLI loop for AI agent" action provides the right environment-specific command.

Update the CLI before fetching feedback:

```bash
px --update dev
```

For production, run `px --update`. If `px --update` is not recognized because the installed CLI is too old, use the install block copied from Creator Studio once, then use `px --update` for later updates.

After the repo is linked in PlannerXchange and the CLI is authenticated, run the review loop from the builder-owned app repo:

Before watching review feedback, the AI agent should use an outcome the builder already stated. Only when it is unclear should the agent ask:

- Try it privately in my own workspace
- List it so other advisors can find and install it
- Let anyone try a sample using made-up information
- Show a public page where people can learn about it
- Match each advisory firm's branding
- Use or save PlannerXchange information
- Check every app outcome

The agent maps that answer internally to `draft`, `marketplace`, `demo_mode`, `landing_page`, `private_label`, `data_persistence`, or `all`. It must not show the builder those IDs or implementation terms such as shell, auth, CTA handoff, canonical data, or persistence unless the builder asks.

The `--goal` value only filters findings from the latest full review. It does not start review, rerun a goal-specific review, or select individual pipeline stages. A pushed commit queues the full review pipeline; Creator Studio's `Run fresh review` action can queue the full pipeline for the current commit. PX CLI cannot queue review work.

Do not fix PlannerXchange-data, firm-branding, public-sample, or public-page findings unless the builder selected that outcome or the finding also blocks the selected outcome.

```bash
npm run build
npm run preflight
git add .
git commit -m "Update PlannerXchange app"
git push
px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown
```

This scaffold defines `preflight`. In another app repo, run `npm run preflight` only when that script exists; otherwise run `npm run check` when defined. If neither exists, use the successful production build as the available local validation. Do not invent a missing script or ask the builder to choose.

`px feedback` is the canonical builder-agent command for reading PlannerXchange review feedback. Use it when the builder asks to check PX feedback, review results, approval blockers, publish status, or remaining fixes.

During an automatic retry, human-facing feedback says that PlannerXchange is retrying the check and no action is needed. Internal attempt details may appear in JSON for agents or support, but they are not a limit on code changes, commits, or future full-review requests. If only Demo verification remains unavailable, the review completes, Demo stays off, and other app options are unaffected; do not invent an app-code fix.

Exit codes:

- `0`: review completed and no required fixes remain for the selected goal on the watched commit
- `1`: auth, access, configuration, API, timeout, or unexpected local/platform error; read the terminal error and stop instead of guessing manifest fields
- `2`: PlannerXchange returned required fixes for the selected goal; fix only the current fix group, rebuild, commit, push, and watch again
- `3`: PlannerXchange could not finish a globally required review check after automatic retries; follow the platform support guidance and do not invent an app-code change
- `130`: the user interrupted the command; stop the loop until the builder asks you to continue

Primary command:

- `px feedback --env dev --goal marketplace --commit HEAD --format markdown`: watch the current commit and print goal-scoped feedback for the local agent loop

Advanced review commands:

- `px review list --env dev`: list linked repos visible to the authenticated PlannerXchange user
- `px review latest --env dev --goal marketplace --format markdown`: print goal-scoped latest review feedback for the current GitHub remote
- `px review latest --env dev --goal data_persistence --repo-link-id <id> --format json`: fetch machine-readable review feedback when auto-detection is ambiguous
- `px review open --env dev`: open the matching repo review surface in PlannerXchange

## Local development

1. Work in the builder-owned app repo. Copy this scaffold into the repo root only if you need the optional Vite/plugin baseline.
2. Run `npm install`.
3. Run `npm run dev` — this starts the dev server on `localhost:5173` (Vite default).
4. **Port 5173 is required** — PlannerXchange allows CORS and auth callbacks from `localhost:5173`. Do not change the port.
5. Open the Vite preview and confirm the plugin mounts with the mock shell context from `src/dev-context.ts`.
6. Build your own UI and routes; the default template does not ship a styled frontend starter.
7. Run `npm run build` before publication to generate `distRoot`, `plannerxchange.publish.json`, and `plannerxchange.build-provenance.json`.

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

1. student creates or opens a builder-owned GitHub repository
2. student points their AI coding agent at this repository as PlannerXchange governance context
3. student copies the optional scaffold into the repo root only if they need the baseline shell-plugin files
4. student copies `.env.example` to `.env` when using the scaffold (mock mode is the default)
5. student reads the `plannerxchange/` markdown files first
6. student uses an AI coding agent against the local app repo
7. student builds Phase 1 (local-only app with mock data, using `src/lib/px-gateway.ts` in mock mode when using the scaffold)
8. student wires Phase 2 (PX API integration through the gateway's live mode)
9. student runs `npm run build` then `npm run preflight`
10. student commits and pushes source plus the generated `distRoot` output
11. student logs into PlannerXchange and links the repository for governed publication
12. PlannerXchange pins the linked commit and runs the required CodeQL lane in PlannerXchange-owned review infrastructure
13. the AI agent uses an already-stated app outcome or asks with the plain-language choices above, maps it to an internal goal, then runs `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown` to filter the latest full-review feedback
14. if required fixes return, the agent fixes only the current fix group for that selected goal, rebuilds, commits, pushes, and watches again

The intended UI should require little more than the GitHub URL. PlannerXchange should read the
required metadata from `plannerxchange.app.json` and only ask for optional merchandising overrides
when needed.

## Builder checklist

- Keep `plannerxchange.app.json` aligned with `src/plugin.tsx`.
- Keep `entryPoint` source-oriented and relative to `appRoot`, such as `src/plugin.tsx`; do not replace it with a hashed build file.
- Run `npm run build` before publish and commit the generated `distRoot` output, including the publish manifest and build-provenance file.
- Run `npm run preflight` after building when that script exists; otherwise run `npm run check` when defined. If neither exists, do not invent a validation command.
- Keep Vite `base: "./"` and do not hardcode root-relative build asset paths such as `/assets/logo.png` or `/logo.png`; import images, fonts, and other static files so the build points at hosted app-version assets.
- Do not enable GitHub code scanning just to publish on PlannerXchange. PlannerXchange runs the required CodeQL lane after repo linking.
- Use `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown` after pushing to fetch and filter the latest full-review feedback directly from PlannerXchange instead of relying on manual copy/paste from the shell. This command cannot start or rerun review.
- If `px feedback` exits `2`, fix only the current required fix group for the selected goal in the markdown export, rebuild, commit, push, and watch again.
- Do not hand-edit generated publish or build-provenance files under `distRoot`; let the build regenerate them.
- Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls. Do not manually attach bearer tokens or pass `appInstallationId` in query strings.
- Do not call app-owned backend routes such as `/api/questions`, `/api/results`, `/questions`, or `/results` from shell-published code. Published apps are static frontend plugins; use bundled mock data for preview or documented PX APIs through `authenticatedFetch`.
- Do not add `VITE_API_URL`, `VITE_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, or similar frontend env vars for shell-published runtime behavior.
- Do not add runtime Python scripts, Flask/FastAPI apps, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, or subprocess expectations for shell-published behavior. Python can be local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path.
- Do not add frontend provider keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, `NEXT_PUBLIC_*_API_KEY`, or direct Tavily/OpenAI/Anthropic/Gemini calls for PX/client data. That path needs an accepted enterprise exception before publication.
- Declare the correct `dataPortabilityMode` before linking the repo.
- Do not add app-owned login flows.
- For public landing pages, read `plannerxchange/landing-page.md`; use YouTube or Vimeo embeds only, keep all content public-safe, and route protected CTAs through PlannerXchange-owned handoffs.
- Route app-owned record reads and writes through the PX gateway pattern (`src/lib/px-gateway.ts`). Do not use `localStorage` as a production persistence layer.
- All mock data must use obviously synthetic names and `@example.test` email addresses. Never embed real personal data in source code.
- Assume PlannerXchange owns auth, tenant resolution, branding, and disclosures.
- Do not add app-owned invite links, email-verification flows, password-setup flows, password-reset flows, or onboarding entry flows.
- Configure your router `basename` to the `appBasename` value from the shell context props. In isolated iframe runtimes this may be iframe-local, for example `/plugin-runner.html`, rather than `/apps/<your-app-slug>`.
- Do not add auth routes, sign-in pages, or routes outside your `/apps/<appSlug>` prefix.
- Initialize your router at the `initialPath` context prop so deep links land on the correct view.
- Use `context.navigate("/app-relative-path")` when an internal route should update the visible shell URL. Do not call `window.top`, `window.parent.location`, or hardcode `/apps/<appSlug>`.
- Use `shellAppBasename` only when constructing shell-level deep links or copyable URLs outside the embedded app runtime.
- If the app renders branded chrome, inherit logo, favicon, primary color, secondary color, and font color from PlannerXchange runtime context instead of hardcoding one static brand.
- If the app does not render app-owned branded chrome, do not request `branding.read` just because the starter demonstrates branding fields.
- If the app does not render app-owned disclosure text or links, do not request `legal.read` just because the starter demonstrates legal context.
- Use PlannerXchange APIs and canonical contracts for PX-governed data.
- Save builder-owned work product such as scenarios, recommendations, questionnaire responses, and projections through approved PX app-data APIs or explicit app-owned persistence.
- Create, update, or soft-delete shared PX canonical records only through documented governed canonical APIs with the matching `canonical.*.write` scope.
- Treat `firmId` as the maximum data boundary for PX canonical data. Stricter intra-firm scoping is fine; broader scope is not.
- If the app is nonportable, it may still read approved PX canonical data through PX APIs by default.
- If the app is intentionally nonportable, be explicit about that and avoid requesting PX-canonical scopes you do not need.
- Do not treat immutable PX reference facts as app-writable just because the app can read them.
- Keep requested permission scopes minimal.
- If the app shows a logo, size it responsively because different firms may upload different logo proportions.
- Do not commit machine-local absolute filesystem links in markdown; use repo-relative links only.
- Do not treat the template as frontend direction; the default starter intentionally ships no styled UI.

Auth lifecycle reminder:

- PlannerXchange owns founder onboarding, invited-advisor onboarding, and client identity onboarding.
- PlannerXchange may send private-labeled invitation emails on behalf of a firm, but those identity emails are platform-owned, not app-owned.
- If a user reaches your plugin, assume the shell already handled sign-in, invite redemption, email verification policy, and initial password choice.

## Files

- `plannerxchange.app.json`: publish manifest
- `plannerxchange.preflight.json`: machine-readable preflight checklist
- `AGENTS.md`: repo-level rules for AI coding agents
- `AGENT_CONTEXT_FILES.md`: maintained inventory for this public context pack
- `plannerxchange/ai-index.md`: lookup index that maps build/review tasks to the right docs and schema fields
- `plannerxchange/app-brief.md`: the student-facing project brief
- `plannerxchange/api-reference.md`: HTTP conventions and current builder-facing route matrix
- `plannerxchange/app-access.md`: app-access and entitlement context
- `plannerxchange/app-data-api.md`: builder-owned work-product persistence contract
- `plannerxchange/branding-and-legal-api.md`: whitelabel branding and disclosure contract
- `plannerxchange/context.md`: platform constraints and design reminders
- `plannerxchange/data-contract.md`: current PX canonical data, portability, and auth assumptions
- `plannerxchange/email-api.md`: outbound transactional email contract
- `plannerxchange/landing-page.md`: public landing-page CTA, media, auth, checkout, and data-safety rules
- `plannerxchange/pii-and-security.md`: data-classification and restricted-PII handling rules
- `plannerxchange/publish-notes.md`: publication and review expectations
- `src/plugin.tsx`: PlannerXchange plugin entrypoint
- `src/main.tsx`: local preview host
- `src/dev-context.ts`: mock runtime context for local development
- `src/lib/px-gateway.ts`: mock/live API gateway pattern for PX API calls
- `.env.example`: environment variable template (copy to `.env`)
- `scripts/preflight.mjs`: pre-publish validation script
- `<distRoot>/plannerxchange.publish.json`: generated publish manifest that maps source `entryPoint` values to built artifact files
- `<distRoot>/plannerxchange.build-provenance.json`: generated build evidence that binds source inputs, lockfiles, build command, and committed artifact digests

## Scope

This repository should stay intentionally small:

- AI-agent governance context
- optional minimal starter/example code
- `plannerxchange/` markdown pack
- one strong README

Do not mirror the full platform docs tree into the student repo. The template should carry the
high-signal subset students and their coding agents actually need.

This repository is the public builder context pack. Internal platform architecture, persistence,
security, KMS, infrastructure, and runbook docs remain private in `plannerxchange-platform` and are
not duplicated here.
