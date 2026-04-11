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

## Request transport

All builder-facing routes beyond `/session` and `/shell/bootstrap` require the current app installation context.

**Required header:**

```
x-plannerxchange-app-installation-id: {appInstallationId}
```

Source the value from `ShellRuntimeContext.appInstallationId` passed into `mount()`.

Query-string `appInstallationId` may still work as temporary compatibility in some routes, but new app code should not depend on it.

The student rule is simple:

- read `appInstallationId` from the shell runtime context
- send it in the required header

## Authentication

All protected routes require:

```
Authorization: Bearer {idToken}
```

The `idToken` comes from the same PlannerXchange auth session the app uses for all API calls. Do not create a parallel auth system.

## HTTP conventions

### Single-resource reads

Return the typed JSON object directly:

```json
{
  "id": "hh_abc123",
  "firmId": "firm_123",
  "name": "Smith Household",
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

## `GET /session`

Returns authenticated identity context.

```json
{
  "subject": "sub_123",
  "email": "advisor@firm.com",
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
    "email": "advisor@firm.com",
    "firstName": "Jordan",
    "lastName": "Patel"
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
    "legalName": "Friendly Advisors LLC",
    "displayName": "Friendly Advisors",
    "status": "active"
  },
  "firm": {
    "id": "firm_123",
    "tenantId": "tenant_123",
    "enterpriseId": "enterprise_123",
    "legalName": "Friendly Advisors LLC",
    "displayName": "Friendly Advisors",
    "email": "ops@firm.com",
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
