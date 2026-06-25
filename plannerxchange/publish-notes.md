# Publish Notes

All PlannerXchange-published apps go through the same governed pipeline.

Current publication concepts:

- environments: `dev`, `prod`
- visibility: `private`, `shared_with_specific_users`, `marketplace_listed`
- data portability: `plannerxchange_portable`, `app_managed_nonportable`

Important:

- `dev` and `prod` are PlannerXchange-managed publication targets
- installation is separate from publication
- marketplace listing is separate from selective sharing
- portability is separate from visibility
- PlannerXchange launches hosted build artifacts from the committed `distRoot` directory, not raw source files
- nonportable apps can still publish, but they should not claim eligibility for the PX portability contract
- `plannerxchange_portable` means the code is built to PX canonical data contracts
- builder membership tier and shell enablement decisions are handled inside PlannerXchange, not in this repo
- passing a `dev` publish does not automatically grant `prod` promotion, marketplace listing, `Portable Data`, or `PX Approved`
- the manifest `entryPoint` remains a source path such as `src/plugin.tsx`, resolved relative to `appRoot`
- simple repos use `appRoot: "."` and `distRoot: "dist"`; larger repos may declare a nested app folder and build output folder
- the build must emit `<distRoot>/plannerxchange.publish.json` so PlannerXchange can resolve that source path to the hosted JS module and emitted CSS assets
- the build must emit `<distRoot>/plannerxchange.build-provenance.json` so PlannerXchange can verify the source-input digest, lockfile digests, build command, and artifact digest before upload
- published artifacts must use app-relative asset URLs; keep Vite `base: "./"` and do not ship root-relative `/assets/...`, `/logo.png`, `/images/...`, `/favicon.ico`, or localhost asset references in committed build output
- PlannerXchange runs required CodeQL review for the exact linked commit after repo linking
- standard shell-published apps do not run builder-authored Python, server-side functions, containers, scheduled jobs, or background workers at runtime; Python is local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path

Manifest schema guardrail:

- detected capabilities in PlannerXchange review output are not manifest field names
- do not add `capabilities`, `marketplace`, `portableData`, `demoMode`, `demoModeEnabled`, `supportsDemoMode`, `landingPage`, `landing_page`, `publicLandingPage`, `landingPageEnabled`, or `supportsLandingPage` to `plannerxchange.app.json`
- marketplace intent is expressed with `visibility: "marketplace_listed"`
- portable-data intent is expressed with `dataPortabilityMode: "plannerxchange_portable"`
- data/API access is expressed with exact scope strings in the `permissions` array
- demo mode is enabled in Creator Studio after eligibility review; it is not currently a builder manifest field
- public landing pages are enabled in PlannerXchange after eligibility review; they are not currently builder manifest fields

Visibility management:

- the `visibility` field in `plannerxchange.app.json` sets the initial visibility when linking a repo
- after linking, manage visibility from the Creator Studio in the PlannerXchange workspace
- set visibility to `marketplace_listed` in Creator Studio to make the app discoverable by other users
- visibility changes in Creator Studio take effect immediately without re-publishing
- `private` apps are only visible to the builder's own firm
- `shared_with_specific_users` apps can be shared with specific users or firms
- `marketplace_listed` apps appear in the public marketplace catalog; users sign in only for protected actions such as install, checkout, follow, or review writes

Student checklist before linking the repo:

- use the default Vite port (5173) for local development — PlannerXchange allows CORS and auth callbacks from `localhost:5173`
- confirm `plannerxchange.app.json` matches the actual app
- keep `entryPoint` pointed at the source plugin module, not a built filename
- set the correct `dataPortabilityMode`
- keep permissions minimal
- keep the app shell-compatible
- avoid custom auth or top-level routing
- avoid custom invite, verification, password-setup, password-reset, or onboarding-entry UX
- write a clear summary and description for the listing
- run `npm run build`
- commit and push the generated `distRoot` directory, including `plannerxchange.publish.json` and `plannerxchange.build-provenance.json`

Review guidance:

- universal security and governance checks apply to every app
- PlannerXchange runs CodeQL for the exact linked commit and fails closed when PX CodeQL finds blocking issues or PX-owned evidence cannot be produced
- CodeQL findings copied from PlannerXchange review feedback should be fixed in source code before requesting another review
- apps built to PX canonical data contracts get stricter checks for PX data access patterns
- nonportable apps do not get a self-serve right to store PX/client/subscriber data in builder-owned backends; app-managed storage for real PX data requires demo-only isolation or enterprise exception review
- app-owned identity UX such as custom invite redemption, email verification, or password-setup flows will be treated as governance findings because PlannerXchange owns auth and onboarding
- public landing pages may use YouTube or Vimeo embeds, but app-owned signup, sign-in, password, checkout, billing, lead-capture, provider-connect, upload, protected API, or token-handling behavior will be treated as landing-page findings or broader blockers
- apps that save builder-owned work product inside PX should use the governed PX app-data contract
- apps that mutate shared PX shell data should use governed canonical write APIs with matching `canonical.*.write` scopes, approved fields, explicit user action, optimistic concurrency, and shared-record UI copy
- apps that parse CSV/files must declare `dataIngressDeclarations`; high-risk client/account/custodian CSVs must use `target: "px_import_session"` and `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })` rather than app-owned parsers or `/imports/*` calls
- `openDataImportSession` is a launch-only handoff that returns `{ mode: "canonical_store", status: "launched" }`; do not wait for `completed`, `completed_with_errors`, `cancelled`, `importJobId`, `canonicalRefs`, or `mappingSummary`
- do not invent a Creator Studio mapping-template prerequisite for `px_import_session`; the PlannerXchange import wizard owns upload, suggested field mapping, skipped fields, user confirmation, validation, audit, and canonical import
- if the PX import wizard URL opens but the wizard screen is blank, treat that as a PlannerXchange shell/runtime issue or stale deployed shell; do not tell the builder to configure a mapping template or redesign app CSV code
- if Creator Studio says canonical CSV import or hosted data storage is not allowed on the builder workspace's plan, treat that as a publish eligibility issue; the builder must upgrade the builder workspace or remove the paid capability before publication
- if the PX import wizard says CSV import or hosted data storage is not available in the current workspace, do not tell an installed app user to upgrade; report it as a publisher/workspace-admin configuration issue and do not change app CSV code unless PlannerXchange review names a separate app-code finding
- apps that touch client data, PII, or external egress paths should expect stricter review
- Day 1 external AI/search-provider or third-party egress of PX client data is not allowed; this includes Tavily, OpenAI, Anthropic, Gemini, analytics, support, and vendor APIs unless PlannerXchange accepts an enterprise exception
- runtime Python, Flask/FastAPI, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, subprocess calls, and shell scripts are not supported in the normal shell app path; if live Python is required, ask PlannerXchange which governed product lane applies before coding it
- new direct dependencies are checked for package reputation, typosquat risk, and non-registry sources before approval
- direct KMS clients, decrypt commands, or app-side restricted-PII decrypt helpers are blockers
- apps that pass the full PlannerXchange governance and client-data safety review may earn a `PX Approved` trust badge
- PlannerXchange may show badges such as `Portable Data` or `App-Managed Data` in the catalog
- apps that appear not to be white-label-ready may receive non-blocking risk findings

PX CLI feedback loop:

- GitHub push remains the review trigger.
- The CLI is read-only. It does not publish, deploy, mutate repo links, change pricing, manage billing, or access canonical client data.
- Before fetching feedback, update the CLI with `px --update dev` for the dev shell or `px --update` for production. If that command is not recognized, use the Creator Studio install block once.
- Before watching review feedback, ask the builder which goal applies now: `draft`, `marketplace`, `demo_mode`, `landing_page`, `private_label`, or `data_persistence`.
- After pushing source plus generated `distRoot`, run `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown`. Use `--env prod` only when Creator Studio copies a prod-specific loop for this app.
- Exit `0` means no required fixes remain for the selected goal on the watched commit.
- Exit `1` means the CLI could not complete because of auth, access, configuration, API, timeout, or unexpected local/platform errors. Read the terminal error and do not guess manifest fields from this failure.
- Exit `2` means PlannerXchange returned required fixes for the selected goal. Fix only the current fix group in the markdown export, rebuild, commit, push, and watch again.
- Exit `3` means PlannerXchange review reached a terminal `failed_to_complete` state. Treat this as a platform retry/support state unless the markdown export clearly names an app-code finding.
- Exit `130` usually means the user interrupted the command with Ctrl+C. Stop the loop until the builder asks you to continue.
- Do not fix data-persistence, private-label, demo, or landing-page findings unless the builder selected that capability or the finding also blocks the selected goal.

White-label readiness signals:

- if the app renders branded chrome, it should request `branding.read`
- if the app requests `branding.read`, the source should actually consume PlannerXchange branding context
- avoid hardcoded logo or favicon assets when the app is expected to inherit firm branding
- if the app shows a logo, keep sizing responsive so firm-uploaded assets still look correct even when proportions differ from the mock preview

First workshop-friendly path:

- link the repo
- publish to `dev`
- launch and verify in the firm workspace
- only later consider broader sharing or marketplace listing

Practical artifact rule:

- if `distRoot` is missing, publish will fail
- if `<distRoot>/plannerxchange.publish.json` does not map the manifest `entryPoint`, publish will fail
- if `<distRoot>/plannerxchange.build-provenance.json` is missing or stale, publish will fail before PlannerXchange uploads artifacts
- if the build emits CSS, PlannerXchange should host and load those emitted CSS assets alongside the JS module

## Publication classes

PlannerXchange supports two publication classes:

### 1. Lightweight frontend tools (`html-js`)

For simple utilities, calculators, or worksheets built in plain HTML/CSS/JavaScript. These do not need deep PlannerXchange canonical persistence.

The key distinction is not whether the app is technically dynamic (it may still run JavaScript and call APIs) but whether it uses PlannerXchange canonical data and governed backend behavior.

### 2. Data-aware shell apps (`react`, `vue`, `nextjs`)

For apps that need PlannerXchange canonical data, governed provisioning, app access checks, or richer runtime integration. Runtime and data-contract requirements are stricter. Apps should follow the PlannerXchange runtime and backend contract rather than behave like a fully standalone frontend.

## Portability eligibility gate

Declaring `plannerxchange_portable` in the manifest does not automatically enable portable hosted client PII access. Portability may remain disabled until the portability review passes.

Minimum requirements for the elevated portability review:

- canonical portable data access is API-only
- no direct database access to PlannerXchange-hosted canonical data
- no builder-owned database or app-managed subscriber-data backend for PX/client data in the self-serve shell-published path
- no direct KMS or decrypt access
- no builder-owned MCP connector into PlannerXchange-hosted canonical data
- no persistence of decrypted hosted client PII in browser localStorage, IndexedDB, analytics, or client-side logs
- Day 1 external AI/search-provider or third-party egress of PX client data is **not allowed**; `egressDeclarations` document a request but do not approve it

## Publication risk classes

PlannerXchange assigns a review risk class to each submitted app based on its requested scopes and behavior. The risk class determines which checks the app undergoes.

### Low review

Applies to:

- simple `html-js` calculators
- UI-only tools with no canonical-data access
- apps that do not request sensitive scopes

Checks:

- manifest validation
- build artifact checks
- dependency and security scanning, including required PlannerXchange CodeQL evidence
- app-managed backend/security checks
- auth ownership check (no custom login/sign-up)
- white-label readiness findings when the app targets shell publication

### Standard governed review

Applies to:

- apps that read canonical firm data
- apps that use provisioning and entitlement checks

Checks (everything in low review, plus):

- portability-mode validation
- canonical-data scope review
- policy and entitlement review
- tenant/firm access-path review
- external-egress review when non-PlannerXchange hosts are referenced
- builder-tier eligibility checks for paid-only PX persistence features

### High-risk review

Applies to:

- apps that read or write canonical client data
- apps that request `client.sensitive.read` or `canonical.client.sensitive.read`
- apps that allow export or sync of client data outside PlannerXchange
- apps that parse or upload client, account, transaction, CRM, cost-basis, or restricted-PII CSV/files
- apps that expose client data to external AI providers, plugins, or agents

Checks (everything in standard review, plus):

- explicit automated, CodeQL, and AI review before approval
- scope minimization review
- decrypt-boundary and audit-path review
- data-egress review
- secret and provider-setting review
- rejection of direct canonical-database access patterns
- rejection of app-owned schemas pretending to be PX-portable canonical data
- rejection of hard-delete, purge, provider-secret management, platform-only import route calls, external CSV upload hosts, missing data-ingress declarations, and app-side parent matching/auto-create logic outside governed canonical contracts

### What triggers high-risk classification

An app is treated as high-risk if any of the following are true:

- it reads canonical client records
- it writes canonical client records
- it soft-deletes canonical client, household, account, tax, or provider-linked records
- it allows export or sync of client data outside PlannerXchange
- it parses or uploads real client CSV/files
- it exposes client data to external AI providers, plugins, or agents
- it requires elevated permission scopes targeting `restricted_pii`

See `pii-and-security.md` for the scope-to-classification mapping.

## Common rejection reasons

The following issues are common causes of publication rejection. Check for them before submitting:

1. **Real personal data in source code** — any real email addresses, names, phone numbers, or SSNs in source files, mock data, or config. All mock data must use obviously synthetic names and `@example.test` addresses. Real firm or client PII belongs only in governed PlannerXchange imports and APIs, not committed examples.
2. **localStorage as production persistence** — using `localStorage` or `sessionStorage` as the primary data store instead of the PX app-data API. Browser-local storage is acceptable for mock/demo mode only.
3. **Hardcoded API base URLs** — embedding `https://api.plannerxchange.ai` or AWS execute-api URLs directly in source. Use `ctx.apiBaseUrl` from `ShellRuntimeContext` so the app works across dev/staging/prod environments.
4. **Missing or incorrect manifest fields** — `slug`, `name`, `summary`, `entryPoint`, or `permissions` missing or inconsistent with the actual app behavior.
5. **Undeclared permission scopes** — app code calls APIs that require scopes not listed in `plannerxchange.app.json` permissions.
6. **Invented API routes** — calling PX API routes that do not exist in the `api-reference.md` scope matrix.
7. **Auth/identity bypass** — app attempts its own login flow, password handling, or user registration instead of using PX-provided auth context.
8. **Builder sets appId, appBasename, shellAppBasename, or navigate** — these are PX-assigned or shell-injected at runtime. The builder only controls `slug`.
9. **Bulk or marketing email** — using `email.send` for cold outreach, newsletters, or non-workflow email.
10. **Missing disclosure or branding consumption** — whitelabel apps that hardcode a single brand instead of reading PX branding/legal context.
11. **Missing mount export in built artifact** — the compiled plugin JS chunk must export a named `mount` function (or `pluginModule` object). If the build minifier renames `mount` to something like `m`, the shell cannot load the app. Use the starter template's terser config with `reserved: ["mount", "pluginModule", "manifest"]` and do not switch to esbuild minification.
12. **Missing publish manifest** — the build must emit `<distRoot>/plannerxchange.publish.json` so PlannerXchange can resolve the source `entryPoint` to the hosted JS module. Run `npm run build` and commit the `distRoot` directory.
13. **Missing or stale build provenance** — the build must emit `<distRoot>/plannerxchange.build-provenance.json` so PlannerXchange can verify source inputs, lockfiles, build command, and committed artifact digests before upload. Run `npm run build` after source or build-output changes and commit the regenerated `distRoot` directory.
14. **Root-relative static asset URLs** - committed build output references `/assets/logo.png`, `/logo.png`, `/images/...`, `/favicon.ico`, or localhost asset URLs. Keep Vite `base: "./"`, import assets from source modules, rebuild, and commit the regenerated `distRoot`.
15. **Suspicious new dependency** — new direct dependencies are checked for package-name spoofing, limited npm registry reputation, and non-registry sources. Prefer established npm packages with clear repository, maintainer, license, and release history.
16. **PlannerXchange CodeQL blocking issue** — PlannerXchange runs CodeQL for the exact linked branch commit. Fix high-risk source findings and push a new commit. If feedback says PX CodeQL is still running, no builder action is needed; if it says PX CodeQL infrastructure failed, retry or contact support rather than changing GitHub repo settings.
17. **Manual PlannerXchange auth or installation context** — app code manually attaches bearer tokens, stores tokens, or passes `appInstallationId` in query strings instead of using `ShellRuntimeContext.authenticatedFetch`.
18. **Direct KMS or decrypt access** — app code or dependencies include direct KMS clients, decrypt commands, or restricted-PII decrypt helpers. PlannerXchange decrypts protected data only inside governed backend APIs.
19. **Unsafe shell navigation control** - app code uses `window.top`, `window.parent.location`, or hardcoded `/apps/<appSlug>` prefixes instead of app-relative routes plus `ShellRuntimeContext.navigate`.

20. **Builder-owned backend for PX/client data** - app code or dependencies include builder-owned database clients, ORM clients, service-role keys, database URL env vars, or similar app-managed subscriber-data storage.
21. **Frontend external provider key** - app code references browser-exposed keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, or `NEXT_PUBLIC_*_API_KEY`. Shell-published apps run in users' browsers, so provider keys cannot be shipped.
22. **Undeclared or unsafe CSV/file ingress** - file inputs, `FileReader`, `FormData`, Papa Parse, csv/xlsx packages, drag/drop uploads, external upload hosts, direct `/imports/*` calls, completion-style import-session handling that waits for `completed`/`importJobId`, or high-risk custodian/client CSV parsing without a declared `px_import_session` and `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })`.
23. **Unsupported landing-page fields** - `landingPage`, `landing_page`, `publicLandingPage`, `landingPageEnabled`, and `supportsLandingPage` are not manifest fields. Use the `landing_page` review goal instead.
24. **App-owned public landing-page conversion flow** - a public landing page implements its own signup, sign-in, password, checkout, billing, lead-capture, provider-connect, upload, protected API call, or token-handling path instead of PlannerXchange-owned handoff.
25. **Unapproved landing-page trust or pricing claims** - landing-page copy claims `PX Approved`, `Portable Data`, install availability, ratings, reviews, pricing, security approval, or marketplace status without using PlannerXchange marketplace records.
26. **Runtime Python or script execution** - the app requires PlannerXchange to run `.py` files, notebooks, Flask/FastAPI apps, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, shell scripts, or subprocess commands after publication. Shell-published apps are hosted web artifacts; use local/build-time Python only, or ask PlannerXchange about an approved governed runtime lane.

## PX Approved badge direction

PlannerXchange reserves `PX Approved` for apps that:

- pass the full PX governance and security review
- satisfy portable canonical-data requirements when the app claims portable behavior
- are approved for client-data use inside PlannerXchange

Separate capability labels may include `Portable Data` or `App-Managed Data` in the catalog.

Apps that rely on disallowed external egress of PX client data are not eligible for `PX Approved`.

Warning labels such as `App-Managed Data`, `Not PX Portable`, or external-processor disclosures are exception labels, not approval substitutes. An app using approved external systems should not expect normal `PX Approved` treatment unless the enterprise exception explicitly grants it.

## Permission scopes

Current builder-facing scopes (request only what the app actually needs):

| Scope | Description |
|-------|-------------|
| `tenant.read` | Current tenant context |
| `user.read` | Current user context |
| `client.summary.read` | Client list (display name, status — no raw PII) |
| `client.sensitive.read` | Full client PII (name, DOB, email, phone, address) |
| `canonical.household.read` | Households |
| `canonical.household.write` | Household create/update/soft-delete |
| `canonical.client.summary.read` | Canonical client summary |
| `canonical.client.sensitive.read` | Canonical client PII detail |
| `canonical.client.write` | Client create/update/soft-delete |
| `canonical.account.read` | Accounts with balances |
| `canonical.account.write` | Account create/update/soft-delete |
| `canonical.tax.summary.read` | Household tax summary |
| `canonical.tax.detail.read` | Household tax filing detail |
| `canonical.tax.write` | Household tax filing create/update/soft-delete |
| `canonical.integration_link.write` | Entity integration-link create/update/soft-delete, excluding provider OAuth secrets |
| `canonical.position.read` | Positions |
| `canonical.transaction.read` | Transactions |
| `canonical.cost_basis.read` | Cost basis lots |
| `canonical.security.read` | Security master with PX defaults, firm-resolved classifications, and firm-resolved capital-market expectations |
| `canonical.security.firm_override` | Firm security overrides, allocation blends, and capital-market expectation overrides |
| `canonical.asset_class.write` | Firm asset-class hierarchy/reference writes |
| `canonical.custom_field.write` | Custom field definition writes |
| `canonical.model.read` | Models and holdings |
| `canonical.model.write` | Model writes where exposed |
| `canonical.sleeve.read` | Sleeves and allocations |
| `canonical.crm_note.read` | Synced CRM notes from PlannerXchange-owned integrations |
| `canonical.crm_task.read` | Synced CRM tasks from PlannerXchange-owned integrations |
| `app_access.read` | App access grants |
| `feature_entitlements.read` | Feature entitlements |
| `branding.read` | Firm branding context |
| `legal.read` | Legal/disclosure context |
| `app_data.read` | App-data records (read) |
| `app_data.write` | App-data records (write) |
| `canonical.import.read` | PX-owned import-session/job state |
| `canonical.import.write` | PX-owned import-session workflow |
| `email.send` | Outbound transactional email |

Important:

- `app_data.write` does not permit mutating shared canonical records
- canonical write scopes permit create, update, and soft-delete only through documented governed route families
- canonical `DELETE` is soft-delete only; hard-delete, purge, provider OAuth secret management, and platform repair remain outside installed-app authority
- `client.sensitive.read` is a high-risk scope under tight governance
- `canonical.account.read`, `canonical.position.read`, `canonical.transaction.read`, and `canonical.cost_basis.read` are high-risk when they expose provider-sourced investment or custodian data
- `canonical.crm_note.read` and `canonical.crm_task.read` are high-risk scopes because CRM notes and task descriptions may contain restricted client data
- Explorer-tier builders should assume `app_data.read`, `app_data.write`, and deeper client-data scopes are unavailable until the relevant paid-tier entitlements exist

Shell-owned provider review rule:

- Apps must read synced CRM data only through PlannerXchange `/crm-notes` and `/crm-tasks`.
- Apps receive only CRM records that PlannerXchange has matched and accepted into the normalized CRM surface; unmatched staging records, match candidates, sync jobs, and partner-import progress are shell-only.
- Apps must read provider-sourced investment data only through approved PlannerXchange canonical account, position, transaction, cost-basis, or integration-exposed routes after PlannerXchange mapping.
- Apps must treat provider import jobs, refresh diagnostics, staging payloads, OAuth state, provider object IDs, and tax-lot identifiers as shell-internal governance data, not app data.
- Account UI may show both specific account type and tax treatment. Use `accountType` for product/registration display and generic `taxTreatment` labels (`Taxable`, `Tax-advantaged pre-tax`, `Tax-advantaged post-tax`, `Tax-advantaged pre-and-post`, `Unknown`) for tax classification.
- Apps must not call providers directly, ask for partner API keys/OAuth tokens, call `/integrations/*`, build app-owned partner sync/matching flows, cache CRM/investment content in browser storage, or send CRM/client/account/investment content to Tavily, OpenAI, Anthropic, Gemini, external AI/search providers, or third-party APIs in Day 1 publication.
