# PlannerXchange Context

Use this file as governance context for the builder-owned app repository. If you are reading this from `PlannerXchange/plannerxchange-template` by URL, do not edit the public context pack while building an app; make code changes in the app repo that PlannerXchange will review.

For AI or other API needs, use `plannerxchange/ai-and-connections.md` to collect intent through the builder agent as well as Creator Studio. The generic Connections and app-AI runtime are planned; interview answers do not authorize egress, billing or secret access.

For public live app links and iframe questionnaires, read `plannerxchange/public-app-access.md`. The publicApp/mountPublic calculator contract is implemented locally but requires coordinated deployment and explicit dev pilot enrollment; it does not expand Demo permissions. Email is separately declared and its HTML must follow effective private-label branding.

External marketplace listings for independently hosted apps are under implementation and unavailable. The local first-time Marketing flow keeps URL entry, AI-prefilled preview, optional editing, save-for-later and purchase inside onboarding. Server-scoped progress resumes before the normal shell, and only confirmed listing coverage completes acquisition. Existing members continue managing listings in Creator Studio; missing fields remain builder-completed. Marketing-only access will not authorize GitHub, PX-hosted deployment or canonical data access. Local implementation includes a private shell editor and restricted Marketing onboarding behind an off-by-default flag. These shell-authorized routes do not grant builder apps API access or change this app manifest; Local billing adapters and Creator Studio controls now cover separate listing Checkout, readiness checks, subscription status and cancellation, but AI import, billing and public listing activation remain unreleased. Local ownership controls use DNS website verification and explicit builder rights confirmation, followed by separate platform-admin approval of the saved listing, links and media. This does not certify app code, and payment cannot clear a suspension. Checkout requires approved ownership/content; a Stripe return cannot grant coverage or publish a listing. Unlisting does not cancel billing. Pending paid checkout or an ongoing standalone subscription cannot also receive active included coverage. Local transition controls reserve one of the three included slots, stop standalone renewal, and switch only after confirmed cancellation and the paid term ends, without refunds or proration. Reservations count against the bundle and can be explicitly released without restarting renewal; unlisting alone does not release a pending billing reservation. Downgrades never create automatic listing charges. Failed renewals retain existing approved visibility for at most 72 hours after the confirmed paid-through time, never a new paid term or publication grant. Initial nonpayment, voluntary cancellation and suspension receive no grace. Local publication controls now explicitly publish an approved saved draft with included or confirmed paid coverage, or unlist it without canceling billing. Saving edits leaves the prior public snapshot unchanged. Public discovery rechecks current eligibility and links to the independent provider; it grants no installation, SSO, code approval or canonical data access. These controls remain local and unreleased, behind a separate disabled public rollout gate. The approved community-review policy allows signed-in PX members to attest prior use, labels that use as unverified by PX, and excludes the listing owner's entire firm. Public authors use the generic PX member label; private profile names and firm names are not copied into reviews. Authors can edit or withdraw their own text but cannot clear an admin moderation hold; owners cannot hide other members' reviews. Review storage, the authenticated shell form, admin moderation and public review presentation are implemented locally and unreleased; they require integration and browser acceptance before activation. Do not invent a builder review API, verified-purchase badge, external URL manifest fields or a repo/installation to use this flow. Local AI import work now includes bounded public-page extraction, source-backed suggestions and private media candidates. It preserves builder edits and leaves unsupported fields blank; it cannot save, approve or publish a listing. Local job metadata and atomic allowance/spend reservations now prevent duplicate admission, worker claims and model dispatch. They require server-verified identity and configured PX acquisition limits, without requiring listing payment. Local saved-preview services now retain structured suggestions, source links/times and private media candidates until configured expiry; raw pages, excerpts, prompts and provider responses are discarded. Reopening needs no new AI call or listing payment. Explicit selected-field apply changes only the private draft, preserves newer builder edits and handles retries without repeating the edit. It cannot publish, approve or change billing, and media ingestion remains separate. Local shell-only start/status/preview/apply routes and scheduled worker delivery now connect these services, with current Cognito identity checks and the existing PX credential configuration. Neither the routes nor the disabled worker release a builder-app API. Local Creator Studio and URL onboarding now use the creation intent for the first import, show bounded progress updates and reopen the initiating builder's latest saved preview without another AI run. A URL alone never starts paid acquisition. Selected suggestions preview only still-empty fields; explicit apply saves them to the private draft. Unsaved edits block apply, existing saved values remain intact. The local importer uses PX's existing server credential with gpt-6.1-sol to inspect bounded public text/metadata and validated image thumbnails. Explicit onboarding media consent permits bounded ingestion of recommended source media into the private preview; Studio retains explicit media selection. This remains inactive pending operator funding and live acceptance. Local media preparation validates a candidate from the initiating builder's saved preview, current listing access/revision and explicit rights confirmation. Public image fetches require a one-use acquisition allowance; preparation cannot change the draft. The local image decoder has real-image checks. Durable media admission, private normalized-image storage and draft attachment are implemented locally; ready media can be reused after a draft conflict without another download. Attachment preserves the public snapshot and billing. Local image-delivery services recheck current listing access and exact draft/publication references; cleanup removes only expired, never-attached uploads and retains previously attached images. Local shell-only attachment and private/public image routes now connect these services. The existing scheduled worker rotates registered firms for bounded cleanup, and the approved decoder layer is associated with the builder router and existing import worker. Creator Studio includes rights-confirmed media selection and authenticated private previews, preserving unsaved edits and occupied slots. New acquisition requires cleanup readiness; all media flags default off. These shell routes do not grant a builder-app API. Local media integration validation passes. Numeric acquisition policy, Linux/provider/browser acceptance and activation remain pending, so AI import is unavailable. Do not invent an import API or supply identity assertions, model prices or quota settings from a builder app.

Local external-listing referral reporting now includes Creator Studio Analytics
for standalone and included listings: recorded impressions, detail views,
website/login clicks and a UTC date range up to 90 days. Detail click rate is
detail-page website/login clicks divided by detail views and can exceed 100%.
These counts do not verify unique people, arrivals, signups or sales. Compatible
website/login URLs receive PX campaign tags for the provider's own analytics;
builders may disable tags per destination through normal draft approval and
publication. Signed/authentication-exchange or off-origin login URLs remain
untagged. No pixel, provider key or analytics-account connection is needed.
This remains local and unreleased behind a separate disabled analytics gate.
Do not invent a builder analytics API, manifest field or visitor/conversion contract.

For shell-published apps, PlannerXchange owns:

- authentication
- top-level routing
- branding and legal framing
- publication governance
- tenant and firm context
- app installation/update permission approval and administrator-managed
  canonical-data restrictions

Builder apps should not:

- implement their own login flow
- implement public landing-page signup, login, password, checkout, billing, lead-capture, or provider-connect flows
- implement invite redemption, email verification, password setup, password reset, or onboarding entry flows
- assume control of the top-level domain
- bypass PlannerXchange publication rules
- show their own first-launch data permission or record-sharing consent screen
- hardcode one firm's logo, favicon, or color palette when the app is meant to inherit PlannerXchange private-label settings

The `framework` field in the manifest is descriptive metadata for review and support context.
What PlannerXchange actually needs is a shell-compatible web artifact with a stable entry point.

Important `entryPoint` rule:

- keep `entryPoint` source-oriented and relative to the manifest `appRoot`, for example `src/plugin.tsx`
- do not change it to a hashed build filename
- simple repos use `appRoot: "."` and `distRoot: "dist"`
- larger repos may set a repo-relative `appRoot`, repo-relative `distRoot`, and optional `workspacePackage`
- the production build should emit `<distRoot>/plannerxchange.publish.json`
- the production build should emit `<distRoot>/plannerxchange.build-provenance.json`
- PlannerXchange resolves the source `entryPoint` through that generated publish manifest to the hosted JS module and any emitted CSS assets
- PlannerXchange verifies the build-provenance source-input digest, lockfile digests, build command, and artifact digest before hosting the committed `distRoot` output

Critical build export rule:

- the built plugin JS module **must** export `mount` and/or `pluginModule` by their original names
- the PlannerXchange shell loads the plugin dynamically and looks for `module.pluginModule?.mount ?? module.mount`
- if the minifier renames these exports (e.g. `mount` → `m`), the shell cannot find the mount function and the app will fail to load
- the starter template's `vite.config.ts` is preconfigured to preserve these names using terser with `reserved: ["mount", "pluginModule", "manifest"]`
- **do not** switch the minifier to esbuild or remove the terser reserved list without verifying the built output still contains `export { ... mount ... }`
- **do not** rename the `mount` export in `src/plugin.tsx` — the shell depends on this exact name
- the publish review script (`publish-review.mjs`) will block publication if the built artifact does not contain a named `mount` or `pluginModule` export

CodeQL review rule:

- PlannerXchange runs the required CodeQL lane after the repo is linked and the commit is pinned
- builders do not need to enable GitHub code scanning, add a CodeQL workflow, or wait on GitHub Actions
- if PlannerXchange review feedback includes CodeQL findings, fix the source, dependency, or workflow issue and push a new commit
- `PX CodeQL is still running` means no builder action; `PX CodeQL infrastructure failed` means retry/support, not repo settings
- local `npm run preflight` does not replace PlannerXchange CodeQL

Review recovery rule:

- PlannerXchange automatically retries temporary review-processing problems; human-facing output says no action is needed and does not expose an attempt counter
- if a globally required check still cannot complete, treat it as a PlannerXchange problem and do not invent an app-code change
- if only Demo verification cannot complete, the review still completes, Demo stays off, and all other app options keep their own results
- direct Demo violations remain Demo-only fixes; verification uncertainty by itself is not a builder-code finding

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

## Public Landing Pages

PlannerXchange may allow an app to have a public landing page at the canonical
marketplace app URL:

```text
/marketplace/apps/{slug}
```

Landing pages are optional reviewed modes, not publication levels and not
manifest capability fields. Do not add `landingPage`, `landing_page`,
`publicLandingPage`, `landingPageEnabled`, or `supportsLandingPage` to
`plannerxchange.app.json`.

The public landing page can explain the app, show public-safe screenshots, and
embed YouTube or Vimeo demo videos. It must not read live PlannerXchange data,
call protected PlannerXchange APIs, require shell session context, or collect
client, firm, account, tax, CRM, document, upload, auth, payment, or provider
credential data.

PlannerXchange owns the CTA handoff for sign in, sign up, install, checkout,
review, follow, and demo actions. If the app needs a public landing page, read
`landing-page.md` before implementing it.

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

- read [`plannerxchange/email-api.md`](email-api.md) before writing or removing email behavior
- current text workflow email uses `email.send` and `POST /app-email/send` through `ShellRuntimeContext.authenticatedFetch`
- PDF attachments, private report links and a PX report-send dialog are planned; do not infer a callable hook from the plan
- preserve questionnaire completion, recipient intent and PDF download when replacing unsupported transport; show unavailable honestly until the target environment supports report sending
- sending credentials, provider configuration and identity/recipient authentication belong to PX; apps must not implement them
- never assume cross-firm data access; public Demo uses synthetic data and sends nothing
- do not use app email for sign-in links, invite acceptance, verification, password setup, password reset or identity onboarding

Auth lifecycle:

- PlannerXchange owns the identity journey before your plugin mounts.
- Founder self-onboarding, invited-advisor onboarding, and client identity onboarding are shell-managed platform flows.
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

- PX or partner reference facts such as account identifiers, positions, and transactions should not be treated as generically app-writable
- canonical writes are allowed only through documented governed PlannerXchange APIs with matching write scopes, field allowlists, audit, and soft-delete semantics
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
- **asset classes** — PX default hierarchy plus the firm's editable and inheritable hierarchy
- **securities** — global security master with AI-generated PX default classification and capital-market expectation, firm-resolved classification/expectation values, and optional firm-specific return/display overrides
- **models** — target allocation templates with security weights
- **sleeves** — composite of models

Firms populate this data through CSV upload, manual entry, or shell-owned partner imports after PlannerXchange mapping and reconciliation. Builder apps declare permission scopes in the manifest and read the data through governed canonical API routes.

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

When a workflow requires a PX record, its first-use design must handle a firm
with no records. Follow `canonical-entity-controls.md` even if the builder did
not specify an empty state: provide an authorized in-app Add flow, preserve
work, and select the saved canonical ID. A message directing the user to Core
Data is not a complete recovery. Read-only analysis does not require arbitrary
edit/delete features; request only the operations needed by the actual workflow.


- for protected PlannerXchange API calls, use `ShellRuntimeContext.authenticatedFetch`
- ordinary installed-app launch is non-interactive at the shell boundary. The
  app should query approved canonical APIs immediately; it owns workflow/client
  selection UI while PX enforces reviewed authority, firm restrictions, and
  actor access
- installation access defaults to every currently and subsequently accessible
  record within the reviewed declarations. Firm administrators can narrow this
  later in PlannerXchange App restrictions
- the shell-managed fetch attaches user auth and `x-plannerxchange-app-installation-id` for the installed app
- hosted apps should not read, store, or manually send raw bearer tokens
- hosted apps should not pass `appInstallationId` in query strings, route params, or manually assembled URLs
- do not construct PlannerXchange `Authorization` headers in app code
- hard-delete, purge, provider OAuth secret management, destructive repair, and auto-classify routes are not part of the student app contract
- custom fields, firm asset-class hierarchy, security override/allocation edits, and import handoff workflows are builder-facing only through documented governed scopes and route contracts

Marketplace billing boundary:

- published app code should not own payment checkout, payout-account setup, coupon creation, refund issuance, or payout-ledger accounting
- PlannerXchange shell owns app pricing-plan configuration, entitlements, coupon and refund authorization, and commercial access decisions
- payment-processor-hosted surfaces launched from PlannerXchange handle payout-account-native operations such as connected-account onboarding, bank details, and tax profile management
- free app pricing remains available without a payout account, but Creator Studio requires the builder firm's payout account to be active before any paid app pricing model can be selected or saved
- when paid pricing is locked, use the PlannerXchange-owned link to Billing -> Creator payouts; app code and landing pages must not create their own payout-onboarding or checkout workaround
- app code should rely on PlannerXchange app access and entitlements rather than direct payment-processor state to decide whether a paid feature is available
- quantity-based app pricing such as `per_account_monthly` and `per_client_monthly` only makes sense when PlannerXchange can govern those counts from canonical data

Important:

- this repo does not encode the builder's PlannerXchange membership tier
- Explorer-tier builders should assume no PlannerXchange-hosted persistence and no portable canonical-data participation until they upgrade into a paid tier that enables it
- build to the PX canonical contract when the app needs PX-governed data
- platform review and shell enablement decisions happen inside PlannerXchange
- shell publication launches built artifacts from `distRoot`, not raw source files from `appRoot`
- the app should consume PX runtime and data APIs; it should not try to create firms, create users, accept invitations, or own identity provisioning flows
- the app should not assume responsibility for invite-link UX, email-verification UX, or initial password choice UX
- if the app renders branded chrome, request `branding.read` and use resolved logo, favicon, primary color, secondary color, and font color values from the runtime context or approved API payloads
- if the app does not render app-owned branded chrome, do not request `branding.read` just because this starter exposes branding context
- if the app renders disclosure text or disclosure links, request `legal.read` and use the resolved legal context
- if the app does not render app-owned disclosure surfaces, do not request `legal.read` just because this starter exposes legal context
- logo rendering should stay responsive because different firms may upload different aspect ratios and file formats within PX guidance

## Detecting mock vs live mode

Check `isPublicDemo()` before `isShellHosted()`. Public demo is rendered by PlannerXchange, but it is deliberately unauthenticated and must use its synthetic branch:

```typescript
import { isPublicDemo, isShellHosted } from "./plannerxchange";

if (isPublicDemo(ctx)) {
  // Public visitor - preload synthetic data; no protected fetch or persistence
} else if (isShellHosted(ctx)) {
  // Real PlannerXchange shell - use ctx.authenticatedFetch for API calls
} else {
  // Local dev with synthetic mock context - use offline stubs
}
```

**Do NOT use `publicationEnvironment` to decide mock vs live.** `publicationEnvironment: "dev"` means the real PlannerXchange dev tier, not "offline / mock mode." An app that checks `publicationEnvironment !== "dev"` will be permanently stuck in mock mode for every installed user in the dev environment.

**Do NOT use build-time env vars** (e.g. `VITE_PX_MODE`) for this check. Build-time values are baked into the published artifact and cannot change at runtime. When the shell mounts the published plugin, the env var will still have its build-time value, not the runtime truth.

The `isShellHosted()` helper detects real shell context by checking:

- the context is not public demo mode
- `appInstallationId !== "synthetic-installation-context"` - the mock context uses this explicit marker
- `authenticatedFetch` is present

The `px-gateway.ts` helper in `src/lib/` already uses this pattern. Its public-demo gateway exposes synthetic reads and rejects writes; demo UI should normally initialize from its synthetic scenario and keep optional non-identifying changes in component memory.

### API base URL ownership

`ctx.apiBaseUrl` is injected by the PlannerXchange shell and points to the correct API endpoint for the current environment (dev, staging, prod). **Do not maintain an app-side origin allowlist** (e.g. `APPROVED_PX_API_ORIGINS`) to validate `apiBaseUrl`. The shell owns that value; the app cannot influence it. App-side origin validation:

- breaks dev/prod parity (dev uses an API Gateway URL, prod uses `api.plannerxchange.ai`)
- creates a maintenance burden that scales with new environments
- adds no real security - the shell owns authenticated API transport and app-side origin allowlists are not a security boundary

Egress governance is the platform's responsibility and is enforced by the publish review, not by individual app code. Use `ctx.apiBaseUrl` directly when constructing API calls.

`egressDeclarations` are review evidence, not approval. Day 1 self-serve publication has no non-enterprise exception for PX/client data egress to Tavily, OpenAI, Anthropic, Gemini, analytics, support, vendor APIs, or other external processors.

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

- `appBasename` - the router basename for the current runtime document
- `shellAppBasename` - the shell-owned path prefix for shell-level deep links
- `initialPath` — the current in-app path for deep links
- `navigate(path, options?)` - a shell-owned navigation callback for app-relative paths
- `appInstallationId` — the installation ID required for `x-plannerxchange-app-installation-id` headers
- `userId` — the current authenticated user ID
- `firmId` — the current firm context
- `tenantId` — the current tenant

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
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Missing #root container for PlannerXchange plugin mount.");
  }

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

The shell passes routing fields into your plugin entry point:

- `appBasename` - the runtime-document router basename; use this as your router `basename`. In isolated iframe runtimes this may be an iframe-local prefix such as `/plugin-runner.html`.
- `shellAppBasename` - the shell-owned prefix, for example `/apps/household-manager`; use this only for shell-level deep links or copyable URLs
- `initialPath` — the current in-app path (e.g. `/households/abc123`); initialize your router at this path so deep links work correctly
- `navigate(path, options?)` - request a visible shell URL update for an app-relative path such as `/households/abc123`; pass `{ replace: true }` when replacing the current history entry

Do not hardcode either prefix in your source. Always read `appBasename` and, when needed, `shellAppBasename` from the context props.

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
- Use `BrowserRouter` with `basename={context.appBasename}`, or use memory/hash routing initialized from `context.initialPath`.
- Use relative paths in `<Link>` and `navigate()` calls — do not hardcode the prefix in href values
- When an app route should be shareable or bookmarkable, call `context.navigate("/your-app-route")` after your in-app router changes route, or wrap your route-change handler so it updates both your local router and the shell URL.
- Do not use `window.top`, `window.parent.location`, or cross-frame DOM access to control shell routing.

Deep links work naturally. Users can bookmark `/apps/my-tool/households/abc123/accounts` and the shell will mount the app at the correct route.

## App-owned backend routes

PlannerXchange shell-published apps are static frontend plugins. The shell does not host builder-owned API routes behind your app artifact.

Rules:

- do not call relative app backend routes such as `/api/questions`, `/api/results`, `/api/session`, `/questions`, or `/results`
- do not use `VITE_API_URL`, `VITE_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, or similar frontend env vars for shell-published behavior
- do not use frontend external-provider keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, or `NEXT_PUBLIC_*_API_KEY`
- use bundled static/mock data for local preview
- use `context.authenticatedFetch` for documented PlannerXchange APIs when running inside the shell
- if a real external/backend service or AI/search provider is needed for subscriber data, treat that as an enterprise exception path before self-serve publication

## Python and runtime script execution

PlannerXchange does not run builder-authored Python at runtime for standard
shell-published apps.

Rules:

- do not add `.py` files, notebooks, Flask/FastAPI apps, Celery/RQ workers,
  scheduled jobs, serverless functions, Docker containers, subprocess calls, or
  shell scripts that the installed app needs after publication
- do not add manifest fields such as `pythonRuntime`, `backend`, `worker`,
  `jobs`, `lambda`, or `container`
- do not expect PlannerXchange to run app-specific AWS Lambda, ECS/Fargate,
  Docker, Linux process, cron, or background worker resources for this app
- Python may be used as local development, test, analysis, or build tooling only
  when the published app remains a shell-compatible web artifact and does not
  require Python after `distRoot` is built
- if live server-side Python is essential, stop and ask PlannerXchange whether
  the work belongs in an enterprise exception or an approved AI Connector path;
  do not design a self-serve shell-published app around live server-side Python

### Optional standard record form

`ShellRuntimeContext.openCanonicalRecordForm` has a local implementation for
household/client creation; deployment is pending. Feature-detect the actual host
and follow [canonical-entity-controls.md](canonical-entity-controls.md#standard-form-call-and-continuation)
for requests, results, permissions and refresh/selection. Both user authority and
reviewed app write scopes/declarations apply. No accounts form or read-only write
exception is included. Do not call private workspace transports or substitute
form-launch evidence for the app's own canonical reads.
