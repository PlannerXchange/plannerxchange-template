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
- the manifest `entryPoint` remains a source path such as `src/plugin.tsx`
- the build must emit `dist/plannerxchange.publish.json` so PlannerXchange can resolve that source path to the hosted JS module and emitted CSS assets

Student checklist before linking the repo:

- confirm `plannerxchange.app.json` matches the actual app
- keep `entryPoint` pointed at the source plugin module, not a built filename
- set the correct `dataPortabilityMode`
- keep permissions minimal
- keep the app shell-compatible
- avoid custom auth or top-level routing
- avoid custom invite, verification, password-setup, password-reset, or onboarding-entry UX
- write a clear summary and description for the listing
- run `npm run build`
- commit and push the generated `dist/` directory, including `dist/plannerxchange.publish.json`

Review guidance:

- universal security and governance checks apply to every app
- apps built to PX canonical data contracts get stricter checks for PX data access patterns
- nonportable apps may use their own backend, and they may still read approved PX canonical data, but they must not request PX-canonical scopes casually
- app-owned identity UX such as custom invite redemption, email verification, or password-setup flows will be treated as governance findings because PlannerXchange owns auth and onboarding
- apps that save builder-owned work product inside PX should use the governed PX app-data contract rather than trying to mutate immutable PX reference facts
- apps that touch client data, PII, or external egress paths should expect stricter review
- Day 1 external AI-provider or third-party egress of PX client data is not allowed
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
- dependency and security scanning
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

- explicit automated plus AI review before approval
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
- Explorer-tier builders should assume `app_data.read`, `app_data.write`, and deeper client-data scopes are unavailable until the relevant paid-tier entitlements exist
