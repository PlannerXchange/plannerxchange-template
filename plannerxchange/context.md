# PlannerXchange Context

PlannerXchange owns:

- authentication
- top-level routing
- branding and legal framing
- publication governance
- tenant and firm context

Builder apps should not:

- implement their own login flow
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

For data architecture, default to PX canonical contracts whenever the app needs PlannerXchange data:

- `plannerxchange_portable`
  - use PlannerXchange-governed APIs and PX canonical data contracts
  - use this when the app needs firm, advisor, client, household, account, or other PX-governed data domains

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
- call `POST /app-email/send` with the idToken from the active session and the `appInstallationId` from `ShellRuntimeContext`
- the app does not manage sending credentials or provider configuration — PlannerXchange owns that
- see `docs/builder-spec/outbound-email-v1.md` for the full API contract and required manifest declaration
- builders should never assume cross-firm data access

Data provenance model:

- PX canonical data
  - should follow the firm across apps

- app-owned data
  - may live in app-owned systems or approved PX app-data storage and remain outside the PX portability contract

- integration-exposed data
  - may remain in approved partner systems and be surfaced through PX-governed integration paths

Reference facts versus work product:

- immutable PX or partner reference facts such as account identifiers, positions, and transactions should not be treated as generically app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, and projections should be saved separately through approved PX app-data APIs or explicit app-owned persistence

## Canonical data available out-of-the-box

PlannerXchange maintains canonical firm data that apps can read without building their own data layer:

- **households** — top-level client groupings
- **clients** — individual people (with PII protections; summary vs sensitive scopes)
- **accounts** — financial accounts with balances, custodian info, and ownership
- **positions** — point-in-time holdings within accounts (date-specific)
- **transactions** — trade and cash activity (date-specific)
- **cost basis** — tax-lot records (date-specific)
- **securities** — platform-level security master with firm-specific overrides
- **models** — target allocation templates with security weights
- **sleeves** — composite of models

Firms import this data through CSV upload or manual entry in the PlannerXchange shell. Builder apps declare permission scopes in the manifest and read the data through governed `/canonical/` API routes.

For entity fields, API routes, scopes, and field-level required/optional guidance, see `data-contract.md` and `docs/builder-spec/canonical-data-api-v1.md`.

Important:

- this repo does not encode the builder's PlannerXchange membership tier
- build to the PX canonical contract when the app needs PX-governed data
- platform review and shell enablement decisions happen inside PlannerXchange
- shell publication launches built artifacts from `dist/`, not raw source files from `src/`
- the app should consume PX runtime and data APIs; it should not try to create firms, create users, accept invitations, or own identity provisioning flows
- if the app renders branded chrome, request `branding.read` and use resolved logo, favicon, primary color, secondary color, and font color values from the runtime context or approved API payloads
- logo rendering should stay responsive because different firms may upload different aspect ratios and file formats within PX guidance

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
- Do not navigate outside the scoped prefix
- Use `BrowserRouter` with `basename` (not `MemoryRouter`) so deep links and browser history work correctly
- Use relative paths in `<Link>` and `navigate()` calls — do not hardcode the prefix in href values

Deep links work naturally. Users can bookmark `/apps/my-tool/households/abc123/accounts` and the shell will mount the app at the correct route.
