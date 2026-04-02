# PlannerXchange App Access and Feature Entitlements

This document defines how builder apps check whether a user can access the app and which features are available.

## Core rule

Access is modeled through explicit grants and feature entitlements, not only through broad user roles. This is especially important for `client_user` access — do not assume every client can reach every app.

## User categories

| Category | Description |
|----------|-------------|
| `firm_user` | Advisors, admins, and firm operational staff |
| `client_user` | End investors or household members |

## Firm-side roles

| Role | Description |
|------|-------------|
| `platform_admin` | Internal PlannerXchange operators only |
| `enterprise_admin` | Oversees app policy and marketplace behavior across many firms inside a dedicated enterprise |
| `firm_admin` | Full firm-level administrative authority |
| `advisor_user` | Firm-side advisor with discrete permission toggles; does not automatically have every admin capability |

Builder rules for roles:

- do not assume every `advisor_user` can install apps, configure integrations, manage AI settings, change billing, or alter firm-wide app configuration
- treat `firm_admin` as the role that carries the full firm-admin permission set
- if an app introduces stricter intra-firm boundaries, prefer configurable or firm-configurable visibility rules over hardcoded sub-scoping

## App access grant

An `app_access_grant` records whether a specific user can access a specific app installation.

### `GET /app-access/me`

**Required scope:** `app_access.read`

**Response:**

```json
{
  "appId": "app_rebalancer",
  "appInstallationId": "install_123",
  "userType": "firm_user",
  "userId": "firm_user_456",
  "status": "active",
  "grantedAt": "2026-03-19T15:04:05Z",
  "grantedByFirmUserId": "firm_user_admin_001"
}
```

Builder rules:

- do not assume access to an app based only on `client_user` status — verify through this endpoint
- treat grant creation and revocation as PlannerXchange-managed provisioning, not as something the app controls
- an app with `shared_with_specific_users` visibility still relies on explicit grants for the actual allowed-principal list — visibility alone is not the full access-control model

## Feature entitlements

A `feature_entitlement` records access to a specific feature inside an app. A client may have access to the app but not to every feature inside it.

### `GET /feature-entitlements/me`

**Required scope:** `feature_entitlements.read`

**Response:**

```json
{
  "appId": "app_rebalancer",
  "appInstallationId": "install_123",
  "userType": "firm_user",
  "userId": "firm_user_456",
  "items": [
    {
      "featureKey": "recommendations.view",
      "status": "active"
    },
    {
      "featureKey": "recommendations.publish",
      "status": "inactive"
    }
  ]
}
```

Builder rules:

- feature checks should be app-specific
- builder apps should consume entitlements, not assume they own the entitlement lifecycle
- both `firm_admin` and `advisor_user` may provision client access in v1

## Cross-tenant marketplace rule

An app may originate from the shared PlannerXchange marketplace and be provisioned into a dedicated enterprise tenant later.

- app origin and app runtime installation are separate concepts
- access checks should be tied to installation/runtime context, not marketplace origin
- a dedicated enterprise tenant does not automatically inherit the shared marketplace catalog
- cross-tenant access requires explicit platform and app-owner authorization

## Builder summary

- tie feature entitlements to app context
- do not hardcode a single "client role" as the only source of authorization
- expect access control at both app and feature level
- prefer explicit platform grants over app-local assumptions
- treat advisor-side elevated actions as explicit PlannerXchange permissions rather than assuming every advisor can administer the firm
- keep any stricter intra-firm boundaries inside the enclosing `firmId` boundary
