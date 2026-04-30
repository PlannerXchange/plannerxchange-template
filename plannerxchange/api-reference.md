# PlannerXchange API Reference

This document defines the HTTP conventions, error handling, request transport, and scope-to-route mapping for builder apps running on PlannerXchange.

## Core rule

Apps integrate through approved PlannerXchange APIs. Published apps do not receive direct database access, even though PlannerXchange owns canonical data storage. The API contract is the integration boundary.

## API base URL

The API base URL is environment-specific. Do not hardcode `https://api.plannerxchange.ai` or any AWS execute-api URL.

**Source the base URL from `ShellRuntimeContext.apiBaseUrl`:**

```typescript
const ctx: ShellRuntimeContext = /* passed into mount() */;
const url = `${ctx.apiBaseUrl}/canonical-data/households`;
```

This ensures the app works correctly across dev, staging, and production environments. The shell injects the correct base URL for the current environment.

For local development without the shell, `dev-context.ts` provides a mock context with a default API URL that can be overridden via `VITE_PX_API_BASE` env var.

## Local development

### Port configuration

PlannerXchange's dev environment allows CORS and Cognito callbacks from `localhost:5173`.

Vite uses port 5173 by default, so no configuration is needed. If you change the port, you may encounter CORS or authentication errors.

**Recommendation:** Use the default Vite port (`npm run dev` starts on `localhost:5173`).

### Mock mode vs live mode

Local development has two practical modes. Published behavior should be selected from the shell runtime context, not build-time env vars:

**Mock mode (default):**
- Uses synthetic context from `dev-context.ts`
- API calls go through `px-gateway.ts` which returns mock data
- No real authentication required
- Ideal for building and testing UI without a PlannerXchange account

**Live mode:**
- Run inside the PlannerXchange shell so the shell injects `authenticatedFetch`
- Requires a real app installation context

Important: Real data calls must run inside the PlannerXchange shell so the app receives a real `appInstallationId` and shell-managed `authenticatedFetch`. The `dev-context.ts` file provides mock values that will not authenticate against the live API.

**To work with real dev data from localhost:**

1. Ensure your app is linked and published to the dev environment
2. Install the app in your firm workspace
3. Launch the app from the PlannerXchange shell (the shell injects real tokens)

Local development is primarily designed for frontend iteration with mock data. Real data integration testing should happen through the PlannerXchange shell.

## Request Transport And Authentication

Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls:

```typescript
const response = await ctx.authenticatedFetch?.("/households", {
  method: "GET"
});
```

The shell-managed fetch attaches the current user auth and `x-plannerxchange-app-installation-id` for the installed app. Hosted apps should not read, store, or manually send raw bearer tokens.

The student rule is simple:

- use `authenticatedFetch` for protected PlannerXchange API calls
- keep `appInstallationId` as app context, but do not manually attach auth headers
- do not put `appInstallationId` in query strings, route params, or manually assembled URLs
- do not read, store, or forward `idToken` or bearer tokens for PlannerXchange API calls
- do not call shell-only routes such as `/integrations/*`, `/admin/*`, `/workspace/*`, `/builder/*`, or `/shell/route-capability`

Public demo exception:

- `/apps/{slug}/demo` can mount a marketplace-listed, published, demo-enabled app without authentication
- demo context has `runtimeMode: "public_demo"`, `isDemoMode: true`, `demoDataMode: "synthetic"`, no protected `authenticatedFetch`, and `idToken: ""`
- demo mode must not call protected PlannerXchange APIs or expect canonical/client/app-data access
- use bundled sample data or clearly synthetic records in demo mode

## HTTP conventions

### Single-resource reads

Return the typed JSON object directly:

```json
{
  "id": "hh_abc123",
  "firmId": "firm_123",
  "name": "Example Household",
  "status": "active"
}
```

### List reads

Return `{ items, pageInfo }`:

```json
{
  "items": [],
  "pageInfo": {
    "limit": 25,
    "nextCursor": "cursor_123"
  }
}
```

### Create and update writes

Return the resulting record payload.

### Common query parameters

| Parameter | Used on | Purpose |
|-----------|---------|---------|
| `limit` | All list routes | Page size (default 25) |
| `cursor` | All list routes | Opaque pagination cursor from `pageInfo.nextCursor` |
| `status` | Households, clients, accounts | Filter by record status |
| `search` | Households, clients, accounts, securities | Text search on name/ticker/CUSIP |
| `householdId` | Clients, accounts, app-data | Filter by household |
| `clientUserId` | App-data | Filter by client user |
| `asOfDate` | Positions, cost basis | ISO date snapshot (default = latest) |
| `startDate`, `endDate` | Transactions | ISO date range (default = last 90 days) |
| `recordType` | App-data | Filter by app-data record type |

## Error envelope

All builder-facing errors return a standard envelope:

```json
{
  "ok": false,
  "code": "missing_scope",
  "message": "canonical.client.summary.read is required for this route.",
  "requestId": "req_123",
  "retryable": false,
  "details": [
    {
      "field": "permissions",
      "issue": "missing_scope",
      "value": "canonical.client.summary.read"
    }
  ]
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `ok` | boolean | Always `false` for errors |
| `code` | string | Machine-readable error code |
| `message` | string | Human-readable description |
| `requestId` | string | Correlation ID for debugging |
| `retryable` | boolean | Whether the client should retry |
| `details` | array | Optional structured detail objects |

Common error codes:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `missing_scope` | 403 | App manifest does not declare the required permission scope |
| `installation_not_found` | 403 | `x-plannerxchange-app-installation-id` is missing or invalid |
| `not_found` | 404 | Requested resource does not exist in the current firm context |
| `validation_error` | 400 | Request body failed validation |
| `rate_limited` | 429 | Too many requests — back off and retry |
| `internal_error` | 500 | Platform error — retryable |

## Tier availability rule

Not every documented capability is available on every membership tier.

- Shell runtime context, branding, legal, and builder identity reads work on all tiers
- Explorer-tier builders should assume no PlannerXchange-hosted app-data persistence
- Explorer-tier builders should assume no PlannerXchange-portable canonical client-data participation
- Paid tiers unlock deeper PlannerXchange-hosted persistence and portable-data behavior subject to review and scope approval

## Current live route-path rule

Builder docs still describe the intended canonical namespace under `/canonical/*`.

Current live platform route registration for canonical reads is root-scoped instead, for example:

- `/households`
- `/clients`
- `/households/{householdId}/clients`
- `/accounts`
- `/accounts/{accountId}/positions`

If your app is calling the live backend today, use the current live platform paths below.

## Locked v1 scope matrix

| Scope | Current live routes | Purpose |
|-------|---------------------|---------|
| `tenant.read` | `/session`, `/shell/bootstrap` | Authenticated tenant context |
| `user.read` | `/session`, `/shell/bootstrap` | Authenticated actor context |
| `client.summary.read` | `/client-users`, `/client-users/{id}` | Summary-safe client records (no raw PII) |
| `client.sensitive.read` | Reserved | Protected client subpaths (future) |
| `canonical.household.read` | `/households`, `/households/{id}` | Firm-scoped households |
| `canonical.client.summary.read` | `/clients`, `/households/{householdId}/clients` | Summary-safe canonical clients |
| `canonical.client.sensitive.read` | `/households/{householdId}/clients/{id}` | Full client detail with PII fields |
| `canonical.account.read` | `/accounts`, `/accounts/{id}`, `/households/{householdId}/accounts`, `/households/{householdId}/accounts/{id}` | Accounts and balances |
| `canonical.position.read` | `/accounts/{id}/positions` | Account positions |
| `canonical.transaction.read` | `/accounts/{id}/transactions` | Account transactions |
| `canonical.cost_basis.read` | `/accounts/{id}/cost-basis` | Cost basis tax lots |
| `canonical.security.read` | `/securities`, `/securities/{id}` | Platform security master with firm overrides |
| `canonical.model.read` | `/models`, `/models/{id}/holdings` | Models and holdings |
| `canonical.sleeve.read` | `/sleeves`, `/sleeves/{id}/allocations` | Sleeves and allocations |
| `canonical.crm_note.read` | `/crm-notes`, `/crm-notes/{id}` | Synced CRM notes from shell-owned partner integrations such as Wealthbox |
| `canonical.crm_task.read` | `/crm-tasks`, `/crm-tasks/{id}` | Synced CRM tasks from shell-owned partner integrations such as Wealthbox |
| `app_access.read` | `/app-access/me` | Current user's app access grant |
| `feature_entitlements.read` | `/feature-entitlements/me` | Current user's feature entitlements |
| `branding.read` | `/branding/current` | Resolved branding for current firm context |
| `legal.read` | `/legal/current` | Resolved legal/disclosure for current context |
| `app_data.read` | `/app-data`, `/app-data/{id}` | Builder-owned work-product records |
| `app_data.write` | `/app-data` (POST), `/app-data/{id}` (PATCH) | Create/update builder-owned work-product |
| `email.send` | `/app-email/send` | Send transactional email through PX relay |

Important:

- `app_data.write` is not a canonical write scope — it covers builder-owned work product only
- `client.sensitive.read` is high-risk and requires stronger review and governance
- Requesting client-data scopes does not permit external AI-provider or third-party egress of PX client data
- Partner OAuth integrations such as Altruist are shell-owned PlannerXchange workflows. Apps do not receive partner OAuth tokens and should consume Altruist-sourced data only after PlannerXchange maps it into approved canonical or integration-exposed APIs.
- Altruist-derived household, account, position, transaction, and cost-basis records are builder-facing only after PlannerXchange reconciliation. Apps must not call `/integrations/altruist/*`, inspect Altruist import jobs, or use unreconciled staging/diagnostic payloads as app data.
- CRM integrations such as Wealthbox are shell-owned PlannerXchange workflows. Apps do not receive Wealthbox API keys and should consume Wealthbox-sourced notes/tasks only through `/crm-notes` and `/crm-tasks` with the declared read scopes.
- CRM reads expose only records that PlannerXchange has matched and accepted into the normalized CRM surface. Unmatched staging records, match candidates, sync jobs, and partner-import progress are shell-only and are not available to installed apps.
- Student apps should treat an empty CRM response as normal: the firm may not have connected the CRM yet, or a firm admin may not have completed the matching flow.

## `GET /session`

Returns authenticated identity context.

```json
{
  "subject": "sub_123",
  "email": "advisor@example.test",
  "tenantId": "tenant_123",
  "audience": "plannerxchange-shell"
}
```

## `GET /shell/bootstrap`

Returns full shell runtime context for the current authenticated user.

```json
{
  "user": {
    "id": "firm_user_123",
    "type": "firm_user",
    "email": "advisor@example.test",
    "firstName": "Avery",
    "lastName": "Example"
  },
  "tenant": {
    "id": "tenant_123",
    "slug": "shared-marketplace",
    "name": "PlannerXchange Marketplace",
    "mode": "shared_marketplace",
    "isolationTier": "shared"
  },
  "enterprise": {
    "id": "enterprise_123",
    "tenantId": "tenant_123",
    "legalName": "Example Advisory LLC",
    "displayName": "Example Advisory",
    "status": "active"
  },
  "firm": {
    "id": "firm_123",
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "legalName": "Example Advisory LLC",
    "displayName": "Example Advisory",
    "email": "ops@example.test",
    "status": "active"
  },
  "membership": {
    "id": "membership_123",
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "firmId": "firm_123",
    "userType": "firm_user",
    "userId": "firm_user_123",
    "role": "advisor_user",
    "status": "active"
  },
  "firmMembershipPlan": {
    "id": "current",
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "firmId": "firm_123",
    "memberTier": "premium",
    "foundingMemberStatus": "active",
    "householdLimit": 250,
    "status": "active"
  },
  "branding": {
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "firmId": "firm_123",
    "primaryColor": "#102033"
  },
  "legal": {
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "firmId": "firm_123",
    "disclosureText": "Approved for advisor use inside PlannerXchange."
  },
  "maskingPolicy": {
    "accountNumber": "last5"
  },
  "installedApps": [
    {
      "installationId": "install_123",
      "appId": "app_rebalancer",
      "publicationEnvironment": "dev",
      "slug": "rebalancer",
      "name": "Rebalancer",
      "dataPortabilityMode": "plannerxchange_portable",
      "visibility": "private",
      "permissions": ["tenant.read", "user.read", "canonical.client.summary.read", "app_data.write"]
    }
  ]
}
```

Key bootstrap fields for builder apps:

- `user` — current signed-in user identity
- `firm` — current firm context (all data is firm-scoped)
- `membership.role` — `firm_admin`, `advisor_user`, etc.
- `firmMembershipPlan.memberTier` — determines available capabilities
- `branding` — resolved brand colors, logo, favicon for white-label rendering
- `legal` — resolved legal/disclosure content
- `maskingPolicy` — controls how sensitive display fields should be masked
- `installedApps` — the apps installed in this firm with their granted permissions

## Platform-managed vs builder-facing APIs

Builder apps should **not** call platform-managed APIs for:

- firm creation, user creation, or invitation acceptance
- membership assignment or billing management
- app-access grant creation or feature-entitlement provisioning
- publication, review, or deployment workflows

These are PlannerXchange-managed operations. Builder apps consume the results (through `/shell/bootstrap`, `/app-access/me`, `/feature-entitlements/me`) but do not invoke the provisioning flows.
