# PlannerXchange Context

PlannerXchange owns:

- authentication
- top-level routing
- branding and legal framing
- publication governance
- tenant and firm context

Builder apps should not:

- implement their own login flow
- implement invite redemption, email verification, password setup, password reset, or onboarding entry flows
- assume control of the top-level domain
- bypass PlannerXchange publication rules
- hardcode one firm's logo, favicon, or color palette when the app is meant to inherit PlannerXchange private-label settings

The `framework` field in the manifest is descriptive metadata for review and support context.
What PlannerXchange actually needs is a shell-compatible web artifact with a stable entry point.

Important `entryPoint` rule:

- keep `entryPoint` source-oriented, for example `src/plugin.tsx`
- do not change it to a hashed build filename
- the production build should emit `dist/plannerxchange.publish.json`
- PlannerXchange resolves the source `entryPoint` through that generated publish manifest to the hosted JS module and any emitted CSS assets

Critical build export rule:

- the built plugin JS module **must** export `mount` and/or `pluginModule` by their original names
- the PlannerXchange shell loads the plugin dynamically and looks for `module.pluginModule?.mount ?? module.mount`
- if the minifier renames these exports (e.g. `mount` → `m`), the shell cannot find the mount function and the app will fail to load
- the starter template's `vite.config.ts` is preconfigured to preserve these names using terser with `reserved: ["mount", "pluginModule", "manifest"]`
- **do not** switch the minifier to esbuild or remove the terser reserved list without verifying the built output still contains `export { ... mount ... }`
- **do not** rename the `mount` export in `src/plugin.tsx` — the shell depends on this exact name
- the publish review script (`publish-review.mjs`) will block publication if the built artifact does not contain a named `mount` or `pluginModule` export

CodeQL review rule:

- keep `.github/workflows/codeql.yml` in the builder repo
- PlannerXchange requires GitHub CodeQL code-scanning evidence for the exact linked branch commit
- if PlannerXchange review feedback includes CodeQL findings, fix the source, dependency, or workflow issue and push a new commit
- do not remove the CodeQL workflow, disable code scanning, or dismiss alerts just to pass publication review
- CodeQL runs in GitHub after push; local `npm run preflight` does not replace it

Common frontend values:

- `react`
- `vue`
- `nextjs`
- `html-js`

Styling is flexible:

- plain CSS
- CSS modules
- Tailwind
- Sass
- component-library styling

Choose the smallest stack that fits the app.

PlannerXchange does not prescribe one house visual style for builder apps.

Use your own design system, layout language, typography, and component patterns.

The contract is about shell compatibility, auth/session ownership, disclosure correctness, and data governance, not about copying PlannerXchange's own UI style.

Whitelabel note:

- runtime whitelabel behavior is optional for publication
- use PlannerXchange branding and legal context when the app needs app-owned branded or disclosure surfaces
- do not request those scopes by default if the app does not render those surfaces

For data architecture, default to PX canonical contracts whenever the app needs PlannerXchange data:

- `plannerxchange_portable`
  - use PlannerXchange-governed APIs and PX canonical data contracts
  - use this when the app needs firm, advisor, client, household, account, or other PX-governed data domains
  - this describes the app's alignment to PX canonical contracts, not automatic cross-app portability of every record the app saves

- `app_managed_nonportable`
  - use this when the app's business data lives in app-owned or partner-managed systems
  - the app can still publish through PlannerXchange if it passes security and governance review
  - app-owned data is not eligible for the PX portability contract

Boundary rule:

- `firmId` is the maximum PX canonical data boundary
- builders may impose stricter intra-firm scoping such as per-`advisor_user` access
- stricter intra-firm scoping should preferably be configurable by the builder, firm, or user path rather than hardcoded as one fixed visibility model

Outbound email:

- if the app sends email (questionnaire links, completion confirmations, report delivery), declare `email.send` in the manifest permissions
- call `POST /app-email/send` through `ShellRuntimeContext.authenticatedFetch`
- the app does not manage sending credentials or provider configuration — PlannerXchange owns that
- see `docs/builder-spec/outbound-email-v1.md` for the full API contract and required manifest declaration
- builders should never assume cross-firm data access

- do not use app email for sign-in links, invite acceptance, verification, password setup, password reset, or identity onboarding

Auth lifecycle:

- PlannerXchange owns the identity journey before your plugin mounts.
- Founder self-onboarding, invited-advisor onboarding, and future invited-client onboarding are shell-managed platform flows.
- PlannerXchange may send private-labeled invitation emails on behalf of a firm, but builder apps should treat those identity emails as platform-owned, not app-owned.
- Once your app renders, assume the shell has already resolved session, firm membership, invite state, and branding context.

Data provenance model:

- PX canonical data
  - should follow the firm across apps

- app-owned data
  - may live in app-owned systems or approved PX app-data storage and remain outside the PX portability contract
  - PlannerXchange-hosted app-data is governed and exportable, but not canonical or cross-app portable by default

- integration-exposed data
  - may remain in approved partner systems and be surfaced through PX-governed integration paths

Reference facts versus work product:

- immutable PX or partner reference facts such as account identifiers, positions, and transactions should not be treated as generically app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, and projections should be saved separately through approved PX app-data APIs or explicit app-owned persistence

## Canonical data available out-of-the-box

PlannerXchange maintains canonical firm data that apps can read without building their own data layer:

- **households** — top-level client groupings
- **household tax summary fields** — household-level freshness and status metadata such as `latestTaxYear`, `latestTaxDataSource`, `latestTaxSyncedAt`, and `taxDataStatus`
- **household tax filings** — actual tax data, modeled as year-scoped filing records rather than extra fields on the household root
- **clients** — individual people (with PII protections; summary vs sensitive scopes)
- **accounts** — financial accounts with balances, custodian info, and ownership
- **positions** — point-in-time holdings within accounts (date-specific)
- **transactions** — trade and cash activity (date-specific)
- **cost basis** — tax-lot records (date-specific)
- **securities** — platform-level security master with firm-specific overrides
- **models** — target allocation templates with security weights
- **sleeves** — composite of models

Firms populate this data through CSV upload, manual entry, or shell-owned partner imports such as Altruist after PlannerXchange mapping and reconciliation. Builder apps declare permission scopes in the manifest and read the data through governed canonical API routes.

Current API route paths:

- the single authoritative route table lives in `api-reference.md` under **Locked v1 scope matrix**
- current live routes are root-scoped (e.g. `/households`, `/clients`, `/accounts`), not `/canonical/*`
- do not guess route paths — if a route is not listed in `api-reference.md`, it does not exist for builders

For entity fields, scopes, and field-level required/optional guidance, see `data-contract.md` and `docs/builder-spec/canonical-data-api-v1.md`.

Tax-read rule:

- use household summary fields for list views and quick household tax status
- use household tax-filing records for actual year-specific tax analysis
- do not infer tax history from the household root alone

Integration identity direction:

- current canonical household, client, and account records may expose an optional root `externalId`
- treat `externalId` as a single convenience reference, not as a complete multi-provider identity model
- PlannerXchange direction is to support provider-scoped integration links so the same household, client, or account can map to multiple external systems at the same time
- builder apps should not assume `externalId` identifies the provider or can hold more than one external mapping

Canonical request transport:

- for protected PlannerXchange API calls, use `ShellRuntimeContext.authenticatedFetch`
- the shell-managed fetch attaches user auth and `x-plannerxchange-app-installation-id` for the installed app
- hosted apps should not read, store, or manually send raw bearer tokens
- shell-only canonical admin routes such as import setup, custom-field admin, category mappings, and auto-classify are not part of the student app contract

Marketplace billing boundary:

- published app code should not own Stripe checkout, payout-account setup, coupon creation, refund issuance, or payout-ledger accounting
- PlannerXchange shell owns app pricing-plan configuration, entitlements, coupon and refund authorization, and commercial access decisions
- Stripe-hosted surfaces launched from PlannerXchange handle payout-account-native operations such as connected-account onboarding, bank details, and tax profile management
- app code should rely on PlannerXchange app access and entitlements rather than direct Stripe state to decide whether a paid feature is available
- quantity-based app pricing such as `per_account_monthly` and `per_client_monthly` only makes sense when PlannerXchange can govern those counts from canonical data

Important:

- this repo does not encode the builder's PlannerXchange membership tier
- Explorer-tier builders should assume no PlannerXchange-hosted persistence and no portable canonical-data participation until they upgrade into a paid tier that enables it
- build to the PX canonical contract when the app needs PX-governed data
- platform review and shell enablement decisions happen inside PlannerXchange
- shell publication launches built artifacts from `dist/`, not raw source files from `src/`
- the app should consume PX runtime and data APIs; it should not try to create firms, create users, accept invitations, or own identity provisioning flows
- the app should not assume responsibility for invite-link UX, email-verification UX, or initial password choice UX
- if the app renders branded chrome, request `branding.read` and use resolved logo, favicon, primary color, secondary color, and font color values from the runtime context or approved API payloads
- if the app does not render app-owned branded chrome, do not request `branding.read` just because this starter exposes branding context
- if the app renders disclosure text or disclosure links, request `legal.read` and use the resolved legal context
- if the app does not render app-owned disclosure surfaces, do not request `legal.read` just because this starter exposes legal context
- logo rendering should stay responsive because different firms may upload different aspect ratios and file formats within PX guidance

## Detecting mock vs live mode

Use the `isShellHosted()` helper from `plannerxchange.ts` to decide whether to call real PlannerXchange APIs or fall back to offline mock data:

```typescript
import { isShellHosted } from "./plannerxchange";

if (isShellHosted(ctx)) {
  // Real PlannerXchange shell - use ctx.authenticatedFetch for API calls
} else {
  // Local dev with synthetic mock context - use offline stubs
}
```

**Do NOT use `publicationEnvironment` to decide mock vs live.** `publicationEnvironment: "dev"` means the real PlannerXchange dev tier, not "offline / mock mode." An app that checks `publicationEnvironment !== "dev"` will be permanently stuck in mock mode for every installed user in the dev environment.

**Do NOT use build-time env vars** (e.g. `VITE_PX_MODE`) for this check. Build-time values are baked into the published artifact and cannot change at runtime. When the shell mounts the published plugin, the env var will still have its build-time value, not the runtime truth.

The `isShellHosted()` helper detects real shell context by checking:

- `appInstallationId !== "synthetic-installation-context"` - the mock context uses this explicit marker
- `authenticatedFetch` is present

The `px-gateway.ts` helper in `src/lib/` already uses this pattern.

### API base URL ownership

`ctx.apiBaseUrl` is injected by the PlannerXchange shell and points to the correct API endpoint for the current environment (dev, staging, prod). **Do not maintain an app-side origin allowlist** (e.g. `APPROVED_PX_API_ORIGINS`) to validate `apiBaseUrl`. The shell owns that value; the app cannot influence it. App-side origin validation:

- breaks dev/prod parity (dev uses an API Gateway URL, prod uses `api.plannerxchange.ai`)
- creates a maintenance burden that scales with new environments
- adds no real security - the shell owns authenticated API transport and app-side origin allowlists are not a security boundary

Egress governance is the platform's responsibility and is enforced by the publish review, not by individual app code. Use `ctx.apiBaseUrl` directly when constructing API calls.

## Local development modes

The starter should make the current runtime mode obvious.

### Mock shell + mock data

Use this for:

- UI scaffolding
- routing setup
- contract familiarization

Rules:

- use obviously synthetic names and records
- do not describe mock records as live PlannerXchange data
- keep any mock/live indicator visible enough that testers do not confuse the two

### Mock shell + real PX APIs

Use this only when PlannerXchange has supplied a real installation context separately.

Rules:

- a token and base URL alone do not create a valid installed-app runtime
- a hardcoded dev `appInstallationId` is a mock fixture, not a live installation
- do not claim live PlannerXchange connectivity unless the app is using a real install context

### In-shell or installed-app runtime

This is the authoritative environment for:

- real branding and legal resolution
- real permission and entitlement behavior
- installation-scoped API calls
- publication-accurate runtime behavior

## Plugin lifecycle

The shell manages the plugin lifecycle through `mount()` and `unmount()` exports from the plugin entry point.

### Mount

The shell calls `mount(context)` when the user navigates to the app. The context object provides:

- `appBasename` — the shell-scoped path prefix for the app's router
- `initialPath` — the current in-app path for deep links
- `appInstallationId` — the installation ID required for `x-plannerxchange-app-installation-id` headers
- `userId` — the current authenticated user ID
- `firmId` — the current firm context
- `tenantId` — the current tenant
- `containerElement` — the DOM element to render into

### Unmount and cleanup

The shell calls `unmount()` when the user navigates away. Builder apps **must** clean up:

- unmount React roots (call `root.unmount()`)
- cancel in-flight `fetch` requests via `AbortController`
- clear any `setInterval` or `setTimeout` handles
- remove global event listeners (window resize, message, keyboard)
- revoke any `URL.createObjectURL` references

If the app leaks event listeners, timers, or detached DOM nodes, the shell may flag it as a resource-leak risk during publish review.

### Example plugin lifecycle

```typescript
import { createRoot, Root } from "react-dom/client";

let root: Root | null = null;

export async function mount(context: ShellRuntimeContext) {
  const container = context.containerElement;
  root = createRoot(container);
  root.render(<App context={context} />);
}

export async function unmount() {
  root?.unmount();
  root = null;
}
```

## Firm-side role definitions

| Role | Authority |
|------|-----------|
| `platform_admin` | Internal PlannerXchange operators only. Not available to builder apps. |
| `enterprise_admin` | Oversees app policy and marketplace behavior across many firms inside a dedicated enterprise context. |
| `firm_admin` | Full firm-level administrative authority: install apps, configure integrations, manage billing, alter firm-wide settings. |
| `advisor_user` | Firm-side advisor with discrete permission toggles. Does not automatically carry admin capabilities. |

Builder rules:

- do not assume every `advisor_user` can install apps, manage AI settings, or change billing
- treat `firm_admin` as the role with the full permission set
- if the app introduces stricter intra-firm boundaries, make them configurable rather than hardcoded

## In-app routing

PlannerXchange mounts your app at a shell-scoped path prefix:

```
/apps/<appSlug>/<...internalPath>
```

The shell resolves auth, tenant context, firm context, and app installation state before mounting the plugin. Everything after `/apps/<appSlug>` is your app's internal routing space. Multi-page apps with full navigation hierarchies are expected and supported.

The shell passes two props into your plugin entry point:

- `appBasename` — the full scoped prefix (e.g. `/apps/household-manager`); use this as your router `basename`
- `initialPath` — the current in-app path (e.g. `/households/abc123`); initialize your router at this path so deep links work correctly

Do not hardcode the prefix in your source. Always read `appBasename` from the context props.

For **React Router v6**:

```tsx
createBrowserRouter(routes, { basename: context.appBasename })
// or
<BrowserRouter basename={context.appBasename}>
```

For **Vue Router**:

```js
createRouter({ history: createWebHistory(context.appBasename), routes })
```

Rules:

- Do not claim routes outside `/apps/<appSlug>/*`
- Do not add login, sign-up, or auth routes — the shell owns these
- Do not add invite, verify-email, set-password, or reset-password routes; the shell owns these too
- Do not navigate outside the scoped prefix
- Use `BrowserRouter` with `basename` (not `MemoryRouter`) so deep links and browser history work correctly
- Use relative paths in `<Link>` and `navigate()` calls — do not hardcode the prefix in href values

Deep links work naturally. Users can bookmark `/apps/my-tool/households/abc123/accounts` and the shell will mount the app at the correct route.
