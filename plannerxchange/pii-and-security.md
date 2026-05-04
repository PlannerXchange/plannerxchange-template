# PII and Security Rules for Builder Apps

This document defines the data classification levels and PII handling rules that builder apps must follow when integrating with PlannerXchange.

## Data classification levels

PlannerXchange classifies all hosted data into four levels. Builder apps must respect these classifications when requesting scopes and handling API responses.

### `public`

Data intended for public display.

Examples: marketplace listing text, public app descriptions, category tags.

No special handling required.

### `internal`

Non-public operational data that is not itself highly sensitive.

Examples: publish-job metadata, deployment status, app installation state.

Do not expose in client-side logs or analytics.

### `confidential`

Business-sensitive or user-sensitive data that should be tightly scoped.

Examples: enterprise policy settings, legal profile content, branding overrides.

Do not cache in unprotected client-side storage. Only request when the app needs the data for its core function.

### `restricted_pii`

Highly sensitive regulated or identity-linked data requiring the strongest controls.

Examples: end-investor client PII (names, emails, phones, addresses, dates of birth, SSN/TIN, account numbers, custodian identifiers, tax-lot IDs tied to a household), AI prompts or tool payloads that contain client PII.

This is the highest-risk data class. Apps that request scopes touching `restricted_pii` trigger elevated publication review.

## Day 1 protected field set

The following fields are always treated as `restricted_pii`, regardless of where they appear:

- names (first, last, legal)
- email addresses
- phone numbers
- street addresses
- dates of birth
- SSN or TIN values
- account numbers
- custodian account identifiers
- tax-lot identifiers tied to a household
- any AI prompt or tool payload that contains client PII

## What builders must know about PII protection

PlannerXchange applies multiple protection layers to `restricted_pii` before it reaches your app:

1. **Field-minimized API tiers** — PlannerXchange APIs separate low-risk reads from sensitive reads:
   - **summary view**: identifiers, display-safe metadata, and non-PII operational state only (e.g. `canonical.client.summary.read`)
   - **operational view**: minimum non-sensitive fields needed for normal workflow screens
   - **sensitive view**: decrypted `restricted_pii` returned only for approved roles, scopes, and app-review class (e.g. `client.sensitive.read`, `canonical.client.sensitive.read`)

2. **Decryption happens only in the PlannerXchange backend** — your app never decrypts PII directly. PlannerXchange returns already-resolved values through governed API responses after scope, role, tenant, firm, app, and review-class checks pass.

3. **Account number masking** — account numbers are masked by default. See `data-contract.md` § Account number masking policy for the 4-layer masking model.

Builder apps must not add direct KMS clients, decrypt commands, or app-side restricted-PII decrypt helpers. Direct decrypt access is a publish-review blocker.

## Builder rules for handling PII

Apps that receive `restricted_pii` through PlannerXchange APIs must follow these rules:

- **Do not store PX/client/subscriber data in builder-owned backends** - Neon, Supabase, Firebase, Postgres, MongoDB, Redis, Prisma, service-role keys, and database URL env vars are publish-review blockers for self-serve shell apps that touch PX/client data
- **Do not upload real client CSVs to non-PX hosts** - canonical and high-risk app-owned file ingress must use PlannerXchange-controlled ingress or enterprise exception review
- **Do not call shell-only import routes** - `/imports/*`, mapping, validation, execute, rollback, and import-job routes are PlannerXchange-owned
- **Do not persist decrypted PII in browser storage** — no `localStorage`, `IndexedDB`, `sessionStorage`, or client-side databases
- **Do not send PII to analytics, logging, or error-reporting services**
- **Do not send PII to external AI providers or third-party APIs** — Day 1 external AI-provider or third-party egress of PX client data is not allowed
- **Do not mirror PII into an app-owned shadow schema** — use PlannerXchange canonical data APIs as the source of truth
- **Do not request sensitive scopes you do not need** — request `canonical.client.summary.read` instead of `canonical.client.sensitive.read` when display names and status are sufficient
- **Do not log PII in console output, error messages, or diagnostic payloads**

## Scope-to-classification mapping

| Scope | Data classification |
|-------|-------------------|
| `tenant.read` | internal |
| `user.read` | confidential |
| `client.summary.read` | internal (no raw PII) |
| `client.sensitive.read` | **restricted_pii** |
| `canonical.client.summary.read` | internal (no raw PII) |
| `canonical.client.sensitive.read` | **restricted_pii** |
| `canonical.account.read` | confidential; high-risk review trigger when provider-sourced account data is exposed |
| `canonical.position.read` | confidential; high-risk review trigger when provider-sourced investment data is exposed |
| `canonical.transaction.read` | confidential; high-risk review trigger when provider-sourced transaction data is exposed |
| `canonical.cost_basis.read` | confidential; high-risk review trigger because tax-lot IDs may be restricted_pii |
| `canonical.household.read` | confidential |
| `canonical.security.read` | internal |
| `canonical.model.read` | internal |
| `canonical.sleeve.read` | internal |
| `canonical.crm_note.read` | confidential or **restricted_pii**, depending on note content |
| `canonical.crm_task.read` | confidential or **restricted_pii**, depending on task content |
| `branding.read` | confidential |
| `legal.read` | confidential |
| `app_data.read` | confidential |
| `app_data.write` | confidential |
| `email.send` | confidential |
| `app_access.read` | internal |
| `feature_entitlements.read` | internal |

## Publication review impact

Requesting higher-classification scopes raises the publication review bar:

- **Low review**: apps that only request `public` or `internal` scopes (e.g. simple calculators, UI-only tools)
- **Standard governed review**: apps that request `confidential` scopes (e.g. canonical firm data, provisioning, entitlements)
- **High-risk review**: apps that request `restricted_pii` scopes (e.g. `client.sensitive.read`, `canonical.client.sensitive.read`), request provider-sourced account/position/transaction/cost-basis or CRM note/task scopes, or create external data egress paths
- CSV/file ingress that includes client, account, transaction, CRM, cost-basis, or restricted-PII data is also high-risk and must be declared in `dataIngressDeclarations`

See `publish-notes.md` § Publication risk classes for details on what each review level checks.

## Audit trail

PlannerXchange records application-level audit events when `restricted_pii` is accessed. Builder apps do not need to implement audit logging — the platform handles it. However, builders should be aware that:

- every sensitive-data read is logged with actor identity, app identity, tenant/firm scope, and target entity
- every sensitive-data write is logged
- egress attempts to external destinations are logged and may be blocked
- portability review pass/fail decisions are logged
- audit payloads never contain plaintext `restricted_pii`

## Portability gate for PII access

Declaring `plannerxchange_portable` in the manifest does not automatically grant PII access. Portable apps must pass elevated review before receiving decrypted `restricted_pii`. See `publish-notes.md` § Portability eligibility gate.
