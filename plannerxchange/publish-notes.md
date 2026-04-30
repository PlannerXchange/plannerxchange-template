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
- PlannerXchange launches hosted build artifacts from the committed `dist/` directory, not raw source files
- nonportable apps can still publish, but they should not claim eligibility for the PX portability contract
- `plannerxchange_portable` means the code is built to PX canonical data contracts
- builder membership tier and shell enablement decisions are handled inside PlannerXchange, not in this repo
- passing a `dev` publish does not automatically grant `prod` promotion, marketplace listing, `Portable Data`, or `PX Approved`
- the manifest `entryPoint` remains a source path such as `src/plugin.tsx`
- the build must emit `dist/plannerxchange.publish.json` so PlannerXchange can resolve that source path to the hosted JS module and emitted CSS assets
- the build must emit `dist/plannerxchange.build-provenance.json` so PlannerXchange can verify the source-input digest, lockfile digests, build command, and artifact digest before upload
- linked repo branches must have completed GitHub CodeQL code-scanning results for the exact commit submitted for review

Visibility management:

- the `visibility` field in `plannerxchange.app.json` sets the initial visibility when linking a repo
- after linking, manage visibility from the Creator Studio in the PlannerXchange workspace
- set visibility to `marketplace_listed` in Creator Studio to make the app discoverable by other users
- visibility changes in Creator Studio take effect immediately without re-publishing
- `private` apps are only visible to the builder's own firm
- `shared_with_specific_users` apps can be shared with specific users or firms
- `marketplace_listed` apps appear in the public marketplace catalog for all authenticated users

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
- commit and push the generated `dist/` directory, including `dist/plannerxchange.publish.json` and `dist/plannerxchange.build-provenance.json`
- keep `.github/workflows/codeql.yml` in the repo and wait for the GitHub CodeQL workflow to complete on the pushed branch commit

Review guidance:

- universal security and governance checks apply to every app
- PlannerXchange reads GitHub CodeQL code-scanning evidence for the exact linked commit and fails closed when CodeQL is missing, failed, or unreadable
- CodeQL findings copied from PlannerXchange review feedback should be fixed in source or workflow code before requesting another review
- apps built to PX canonical data contracts get stricter checks for PX data access patterns
- nonportable apps may use their own backend, and they may still read approved PX canonical data, but they must not request PX-canonical scopes casually
- app-owned identity UX such as custom invite redemption, email verification, or password-setup flows will be treated as governance findings because PlannerXchange owns auth and onboarding
- apps that save builder-owned work product inside PX should use the governed PX app-data contract rather than trying to mutate immutable PX reference facts
- apps that touch client data, PII, or external egress paths should expect stricter review
- Day 1 external AI-provider or third-party egress of PX client data is not allowed
- new direct dependencies are checked for package reputation, typosquat risk, and non-registry sources before approval
- direct KMS clients, decrypt commands, or app-side restricted-PII decrypt helpers are blockers
- apps that pass the full PlannerXchange governance and client-data safety review may earn a `PX Approved` trust badge
- PlannerXchange may show badges such as `Portable Data` or `App-Managed Data` in the catalog
- apps that appear not to be white-label-ready may receive non-blocking risk findings

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

- if `dist/` is missing, publish will fail
- if `dist/plannerxchange.publish.json` does not map the manifest `entryPoint`, publish will fail
- if `dist/plannerxchange.build-provenance.json` is missing or stale, publish will fail before PlannerXchange uploads artifacts
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
- no direct KMS or decrypt access
- no builder-owned MCP connector into PlannerXchange-hosted canonical data
- no persistence of decrypted hosted client PII in browser localStorage, IndexedDB, analytics, or client-side logs
- Day 1 external AI-provider or third-party egress of PX client data is **not allowed**

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
- dependency and security scanning, including required CodeQL evidence
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
- apps that expose client data to external AI providers, plugins, or agents

Checks (everything in standard review, plus):

- explicit automated, CodeQL, and AI review before approval
- scope minimization review
- decrypt-boundary and audit-path review
- data-egress review
- secret and provider-setting review
- rejection of direct canonical-database access patterns
- rejection of app-owned schemas pretending to be PX-portable canonical data

### What triggers high-risk classification

An app is treated as high-risk if any of the following are true:

- it reads canonical client records
- it writes canonical client records
- it allows export or sync of client data outside PlannerXchange
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
8. **Builder sets appId or appBasename** — these are PX-assigned at registration and shell-injected at runtime. The builder only controls `slug`.
9. **Bulk or marketing email** — using `email.send` for cold outreach, newsletters, or non-workflow email.
10. **Missing disclosure or branding consumption** — whitelabel apps that hardcode a single brand instead of reading PX branding/legal context.
11. **Missing mount export in built artifact** — the compiled plugin JS chunk must export a named `mount` function (or `pluginModule` object). If the build minifier renames `mount` to something like `m`, the shell cannot load the app. Use the starter template's terser config with `reserved: ["mount", "pluginModule", "manifest"]` and do not switch to esbuild minification.
12. **Missing dist/plannerxchange.publish.json** — the build must emit a publish manifest so PlannerXchange can resolve the source `entryPoint` to the hosted JS module. Run `npm run build` and commit the `dist/` directory.
13. **Missing or stale dist/plannerxchange.build-provenance.json** — the build must emit provenance so PlannerXchange can verify source inputs, lockfiles, build command, and committed artifact digests before upload. Run `npm run build` after source or dist changes and commit the regenerated `dist/` directory.
14. **Suspicious new dependency** — new direct dependencies are checked for package-name spoofing, limited npm registry reputation, and non-registry sources. Prefer established npm packages with clear repository, maintainer, license, and release history.
15. **Missing or failing CodeQL evidence** — PlannerXchange requires GitHub CodeQL results for the exact linked branch commit. Keep `.github/workflows/codeql.yml` enabled, push the workflow with the app, wait for CodeQL to complete, and fix high-risk alerts instead of disabling the scan.
16. **Manual PlannerXchange auth or installation context** — app code manually attaches bearer tokens, stores tokens, or passes `appInstallationId` in query strings instead of using `ShellRuntimeContext.authenticatedFetch`.
17. **Direct KMS or decrypt access** — app code or dependencies include direct KMS clients, decrypt commands, or restricted-PII decrypt helpers. PlannerXchange decrypts protected data only inside governed backend APIs.

## PX Approved badge direction

PlannerXchange reserves `PX Approved` for apps that:

- pass the full PX governance and security review
- satisfy portable canonical-data requirements when the app claims portable behavior
- are approved for client-data use inside PlannerXchange

Separate capability labels may include `Portable Data` or `App-Managed Data` in the catalog.

Apps that rely on disallowed external egress of PX client data are not eligible for `PX Approved`.

## Permission scopes

Current builder-facing scopes (request only what the app actually needs):

| Scope | Description |
|-------|-------------|
| `tenant.read` | Current tenant context |
| `user.read` | Current user context |
| `client.summary.read` | Client list (display name, status — no raw PII) |
| `client.sensitive.read` | Full client PII (name, DOB, email, phone, address) |
| `canonical.household.read` | Households |
| `canonical.client.summary.read` | Canonical client summary |
| `canonical.client.sensitive.read` | Canonical client PII detail |
| `canonical.account.read` | Accounts with balances |
| `canonical.position.read` | Positions |
| `canonical.transaction.read` | Transactions |
| `canonical.cost_basis.read` | Cost basis lots |
| `canonical.security.read` | Security master with firm overrides |
| `canonical.model.read` | Models and holdings |
| `canonical.sleeve.read` | Sleeves and allocations |
| `canonical.crm_note.read` | Synced CRM notes from PlannerXchange-owned integrations |
| `canonical.crm_task.read` | Synced CRM tasks from PlannerXchange-owned integrations |
| `app_access.read` | App access grants |
| `feature_entitlements.read` | Feature entitlements |
| `branding.read` | Firm branding context |
| `legal.read` | Legal/disclosure context |
| `app_data.read` | App-data records (read) |
| `app_data.write` | App-data records (write) |
| `email.send` | Outbound transactional email |

Important:

- `app_data.write` does not permit mutating immutable canonical reference facts
- `client.sensitive.read` is a high-risk scope under tight governance
- `canonical.account.read`, `canonical.position.read`, `canonical.transaction.read`, and `canonical.cost_basis.read` are high-risk when they expose provider-sourced investment or custodian data
- `canonical.crm_note.read` and `canonical.crm_task.read` are high-risk scopes because CRM notes and task descriptions may contain restricted client data
- Explorer-tier builders should assume `app_data.read`, `app_data.write`, and deeper client-data scopes are unavailable until the relevant paid-tier entitlements exist

Shell-owned provider review rule:

- Apps must read synced Wealthbox data only through PlannerXchange `/crm-notes` and `/crm-tasks`.
- Apps receive only CRM records that PlannerXchange has matched and accepted into the normalized CRM surface; unmatched staging records, match candidates, sync jobs, and partner-import progress are shell-only.
- Apps must read Altruist-sourced investment data only through approved PlannerXchange canonical account, position, transaction, cost-basis, or integration-exposed routes after PlannerXchange mapping.
- Apps must treat Altruist import jobs, refresh diagnostics, staging payloads, OAuth state, provider object IDs, and tax-lot identifiers as shell-internal governance data, not app data.
- Account UI may show both specific account type and tax treatment. Use `accountType` for product/registration display and generic `taxTreatment` labels (`Taxable`, `Tax-advantaged pre-tax`, `Tax-advantaged post-tax`, `Tax-advantaged pre-and-post`, `Unknown`) for tax classification.
- Apps must not call Wealthbox or Altruist directly, ask for partner API keys/OAuth tokens, call `/integrations/*`, build app-owned partner sync/matching flows, cache CRM/investment content in browser storage, or send CRM/client/account/investment content to external AI providers or third-party APIs in Day 1 publication.
