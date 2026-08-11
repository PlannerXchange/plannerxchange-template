# PlannerXchange App Data API

`/app-data` is a record API, not a key-value store. Create with
`POST /app-data`, retain the server-issued `recordId`, and update with
`PATCH /app-data/{recordId}`. Do not construct record IDs from client or
application keys. There is no `PUT` route or `{ value }` compatibility shape;
app-owned content is read and written through `payload`.

Small local adapters are supported. Preflight and publication review trace
`authenticatedFetch` through initializer parameters, assignments,
module/object storage, and local wrappers. Keep those edges and `/app-data`
routes statically resolvable; renaming or storing the capability does not change
the request contract.

Production minification may rename the transport, place its runtime-property
capture far from the app-data calls, and compress assignments onto one line.
That is supported when the lexical initializer/assignment path remains
statically resolvable. Retaining a server-issued `recordId` in an in-memory
object or `Map` keyed by a selected client, household, or account does not make
the ID locally fabricated. Request-envelope checks apply only to top-level
properties: `payload: { data: value }` is valid, while top-level `{ value }` is
not.

This document defines the builder-facing write contract for PlannerXchange-hosted app-owned work product.

It is separate from the canonical-data contract. Builder apps read and mutate shared canonical records through governed canonical APIs, and write builder-owned work product through the app-data API family.

## Core rule

Imported or reference facts such as positions, transactions, and tax lots remain read-only through canonical data routes unless PlannerXchange documents a governed write contract. Builder-owned work product (recommendations, scenario runs, questionnaire responses, projections, notes, transaction category rules, category assignment sets, cashflow projection runs, and app-owned upload row sets) is written through the app-data API.

## Availability

- Explorer-tier builders should assume no PlannerXchange-hosted app-data persistence
- Externally hosted showcase apps should use their own persistence
- Shell-published apps on paid tiers may use this contract when the tier entitles PlannerXchange-hosted persistence

## Permission scopes

| Scope | Purpose |
|-------|---------|
| `app_data.read` | Read app-data records for the current app and firm |
| `app_data.write` | Create, update, and soft-delete app-data records for the current app and firm |

These are separate from canonical data scopes.

## Record envelope

Every app-data record has this shape:

```json
{
  "recordId": "appdata_123",
  "recordType": "recommendation_set",
  "title": "2026 rebalance proposal",
  "status": "draft",
  "schemaVersion": 1,
  "appId": "app_rebalancer",
  "appInstallationId": "install_123",
  "firmId": "firm_123",
  "clientUserId": "client_456",
  "householdId": null,
  "accountId": null,
  "sourceRefs": [
    {
      "sourceType": "canonical_account",
      "sourceId": "acct_123",
      "asOf": "2026-03-19T15:04:05Z"
    },
    {
      "sourceType": "integration_exposed",
      "sourceSystem": "custodian_provider",
      "sourceId": "portfolio_789",
      "asOf": "2026-03-19T15:04:05Z"
    }
  ],
  "payload": {
    "summary": "Shift 8% from large-cap growth to short-duration treasuries.",
    "recommendations": []
  },
  "createdAt": "2026-03-19T15:04:05Z",
  "updatedAt": "2026-03-19T15:04:05Z",
  "createdByUserId": "user_123",
  "updatedByUserId": "user_123"
}
```

## Source references

The `sourceRefs` array tracks which data inputs were used to produce this work product. This enables provenance tracking, export, and PlannerXchange review of any later canonical-data promotion.

Allowed source categories:

| Category | Meaning |
|----------|---------|
| `canonical_*` | PlannerXchange canonical inputs (e.g. `canonical_account`, `canonical_position`) |
| `integration_exposed` | Partner-hosted inputs surfaced through PlannerXchange integrations |
| `app_owned_upload` | App-owned files or uploads |
| `manual_entry` | User-entered data |

Each source ref should include:

- `sourceType` — category identifier
- `sourceId` — the entity ID or resource key
- `sourceSystem` — (for `integration_exposed`) the integration partner name
- `asOf` — ISO timestamp of the data snapshot used

## Recommended record types

| Record type | Example use |
|-------------|-------------|
| `scenario_run` | Modeled portfolio scenario with parameters and results |
| `recommendation_set` | Rebalancing recommendations or action items |
| `questionnaire_response` | Client onboarding questionnaire answers |
| `projection_run` | Cashflow projections, retirement simulations |
| `transaction_category_rule_set` | App-owned transaction categorization rules |
| `transaction_category_assignment_set` | App-owned category assignments linked to canonical transactions or app-owned upload rows |
| `cashflow_projection_run` | Cashflow forecast outputs generated by the app |
| `cashflow_upload_row_set` | App-owned parsed CSV rows that remain noncanonical work product |
| `note` | App-authored text snippets, summaries, annotations |

## CSV-derived app-data

Apps may parse CSV files in app code only when the result remains low-risk app-owned work product and is saved through this contract. High-risk client/account/custodian CSV files must be handled by a PX-owned import session. Durable `canonical_store` handoff launches the PlannerXchange Core Data import wizard for upload, suggested field mapping, skipped fields, user confirmation, validation, audit, and canonical import.

Rules:

- declare CSV/file ingress in `plannerxchange.app.json` with `dataIngressDeclarations`
- use `target: "px_import_session"` plus `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })` for high-risk client/account/position/transaction/cost-basis CSVs
- treat `openDataImportSession` as launch-only: it returns `{ mode: "canonical_store", status: "launched" }`, not completed import statuses, `importJobId`, `canonicalRefs`, or `mappingSummary`
- after the user returns to the app, refresh imported canonical data through approved canonical read APIs
- do not invent a Creator Studio mapping-template prerequisite for `px_import_session`
- if `openDataImportSession` is missing from the local `ShellRuntimeContext` type, update `src/plannerxchange.ts` from the current template
- use `sourceRefs` to link app-owned category assignments or projections to canonical accounts/transactions when applicable
- do not create or mutate canonical transactions, accounts, clients, households, positions, cost basis, restricted PII, account-owner links, or import jobs through app-data
- canonical position, transaction, and cost-basis CSV imports must use PlannerXchange-owned import sessions, not app-owned CSV logic
- builder apps may read canonical positions, transactions, and cost basis through approved PX APIs and scopes, then store only derived app-owned work product and source references in app-data
- do not call `/imports/*`, `/integrations/*`, provider import-job routes, or shell-only Core Data mutation routes from app-owned CSV workflows
- do not persist raw PX client, account, custodian, transaction, or tax-lot CSV data in app-data payloads, browser storage, logs, or app-local storage
- app-data categorization records are not cross-app portable until PlannerXchange publishes an explicit canonical contract

## Recommended status values

| Status | Meaning |
|--------|---------|
| `draft` | Work in progress, not yet shared or finalized |
| `final` | Completed and ready for review or sharing |
| `archived` | Soft-deleted or historical |

## Routes

Current route status:

| Route | Status | Notes |
| --- | --- | --- |
| `GET /app-data` | live | builder-owned work-product listing |
| `POST /app-data` | live | builder-owned work-product create |
| `GET /app-data/{recordId}` | live | single-record read |
| `PATCH /app-data/{recordId}` | live | single-record update |
| `DELETE /app-data/{recordId}` | live | soft-delete/archive builder-owned work product |

## Required create fields

Every `POST /app-data` body must include `recordType`, `status`,
`schemaVersion`, and an object `payload`. Local interfaces do not become the PX
contract because they reuse a familiar type name: keep them structurally aligned
with this guide or import the current public PX type through an installed SDK.

### `GET /app-data`

List builder-owned work-product records for the current app and firm.

**Required scope:** `app_data.read`

**Query parameters:** `recordType`, `clientUserId`, `householdId`, `accountId`, `status`, `limit`, `cursor`

Unknown query parameters are rejected. `limit`, when present, must be a positive integer. Record routes do not accept query parameters.

**Response:**

```json
{
  "items": [
    { "recordId": "appdata_123", "recordType": "recommendation_set", "..." : "..." }
  ],
  "pageInfo": { "limit": 25, "nextCursor": "cursor_123" }
}
```

### `POST /app-data`

Create a new work-product record.

**Required scope:** `app_data.write`

**Request body:**

```json
{
  "recordType": "recommendation_set",
  "title": "2026 rebalance proposal",
  "status": "draft",
  "schemaVersion": 1,
  "clientUserId": "client_456",
  "sourceRefs": [
    {
      "sourceType": "canonical_account",
      "sourceId": "acct_123",
      "asOf": "2026-03-19T15:04:05Z"
    }
  ],
  "payload": {
    "summary": "Shift 8% from large-cap growth to short-duration treasuries."
  }
}
```

**Response:** the created record with server-assigned `recordId`, `appId`, `appInstallationId`, `firmId`, `createdAt`, `createdByUserId`.

Create accepts only `recordType`, optional `title`, `status`, `schemaVersion`, optional association IDs, optional `sourceRefs`, and `payload`. `recordType`, `status`, `schemaVersion`, and an object `payload` are required. Status must be `draft`, `final`, or `archived`; `schemaVersion` must be a positive integer.

## Complete TypeScript record lifecycle

This example keeps one app-owned state record per selected client. It lists
first, retains the server-issued ID, creates only when no record exists, and
serializes writes for the same client so concurrent UI actions do not race into
duplicate creates.

```ts
type AppState = { budgets: Record<string, number> };
type AppDataRecord<T extends Record<string, unknown>> = {
  recordId: string;
  payload: T;
};
type AppDataPage<T extends Record<string, unknown>> = {
  items: AppDataRecord<T>[];
};

const recordIdsByClient = new Map<string, string>();
const writesByClient = new Map<string, Promise<void>>();

async function requestJson<T>(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) throw new Error(`PlannerXchange request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function findStateRecord(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  clientUserId: string
): Promise<AppDataRecord<AppState> | undefined> {
  const query = new URLSearchParams({
    recordType: "cashflow_state",
    clientUserId,
    limit: "100"
  });
  const page = await requestJson<AppDataPage<AppState>>(
    authenticatedFetch,
    `/app-data?${query.toString()}`
  );
  const record = page.items[0];
  if (record) recordIdsByClient.set(clientUserId, record.recordId);
  return record;
}

export async function loadState(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  clientUserId: string
): Promise<AppState | undefined> {
  return (await findStateRecord(authenticatedFetch, clientUserId))?.payload;
}

export function saveState(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  clientUserId: string,
  payload: AppState
): Promise<void> {
  const previous = writesByClient.get(clientUserId) ?? Promise.resolve();
  const next = previous.then(async () => {
    let recordId = recordIdsByClient.get(clientUserId);
    if (!recordId) recordId = (await findStateRecord(authenticatedFetch, clientUserId))?.recordId;
    if (recordId) {
      await requestJson(authenticatedFetch, `/app-data/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload })
      });
      return;
    }
    const created = await requestJson<AppDataRecord<AppState>>(authenticatedFetch, "/app-data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recordType: "cashflow_state",
        status: "draft",
        schemaVersion: 1,
        clientUserId,
        payload
      })
    });
    recordIdsByClient.set(clientUserId, created.recordId);
  });
  writesByClient.set(clientUserId, next);
  return next.finally(() => {
    if (writesByClient.get(clientUserId) === next) writesByClient.delete(clientUserId);
  });
}

export async function deleteState(
  authenticatedFetch: (path: string, init?: RequestInit) => Promise<Response>,
  clientUserId: string
): Promise<void> {
  const recordId = recordIdsByClient.get(clientUserId) ??
    (await findStateRecord(authenticatedFetch, clientUserId))?.recordId;
  if (!recordId) return;
  await requestJson(authenticatedFetch, `/app-data/${encodeURIComponent(recordId)}`, {
    method: "DELETE"
  });
  recordIdsByClient.delete(clientUserId);
}
```

## Server-issued record ID provenance

An ID is valid when it comes from `POST /app-data`, `GET /app-data`, a
record-level response, or an explicit route/function parameter documented as an
app-data record ID. It remains server-issued when cached in a browser-memory
object or `Map`, even if that cache is indexed by client, household, or account.
The invalid pattern is constructing the record ID itself from one of those
identities or from a custom prefixed key.

### `GET /app-data/{recordId}`

Fetch one record.

**Required scope:** `app_data.read`

**Response:** single record envelope.

### `PATCH /app-data/{recordId}`

Update mutable fields on an existing record.

**Required scope:** `app_data.write`

**Request body (partial update):**

```json
{
  "status": "final",
  "payload": {
    "summary": "Approved rebalance recommendation."
  }
}
```

**Response:** the updated record.

### `DELETE /app-data/{recordId}`

Soft-delete/archive one builder-owned work-product record for the current app installation.

**Required scope:** `app_data.write`

**Response:** the archived record with `status: "archived"`, deleted metadata, and updated audit fields.

## Record ownership and boundaries

Every record is anchored to:

- `appId` — the app that created it
- `appInstallationId` — the specific installation
- `firmId` — the firm boundary

Optional attachment targets:

- `clientUserId`
- `householdId`
- `accountId`
- `sourceRefs`

Boundary rules:

- `firmId` is the maximum data boundary
- client-, household-, or account-specific app-data must include at least one top-level platform association: `clientUserId`, `householdId`, `accountId`, or `sourceRefs`
- putting `clientId`, `clientDisplayName`, `clientEmail`, `invitationId`, or similar values only inside `payload` is not enough for PlannerXchange governance, filtering, export, lifecycle, or support workflows
- Apps may impose stricter intra-firm scoping — prefer configurable over hardcoded
- Apps should not assume cross-firm visibility

## Client-linked questionnaire examples

Use top-level association fields for client-linked RTQ/questionnaire records.

Firm/app-level template, no client association required:

```json
{
  "recordType": "rtq_template",
  "status": "draft",
  "schemaVersion": 1,
  "payload": {
    "title": "Risk tolerance questionnaire",
    "questions": []
  }
}
```

Patch accepts only `title`, `status`, and `payload`, and at least one must be present. The payload, when present, must be an object. Preflight and publication review validate source and committed build operations independently; declaring permissions does not waive request-contract checks.

Client invitation, top-level `clientUserId` required:

```json
{
  "recordType": "rtq_invitation",
  "status": "draft",
  "schemaVersion": 1,
  "clientUserId": "client_456",
  "payload": {
    "templateRecordId": "appdata_template_123",
    "invitationId": "invite_789",
    "status": "sent"
  }
}
```

Client response, top-level `clientUserId` required and `sourceRefs` recommended when the source should be auditable:

```json
{
  "recordType": "rtq_response",
  "status": "draft",
  "schemaVersion": 1,
  "clientUserId": "client_456",
  "sourceRefs": [
    {
      "sourceType": "canonical_client",
      "sourceId": "client_456"
    }
  ],
  "payload": {
    "invitationId": "invite_789",
    "score": 72,
    "answers": []
  }
}
```

Do not rely on `payload.clientId` as the only association. App-data is builder-owned work product, not a canonical client mutation.

## Mutation rules

Builder apps **may**:

- Create new work-product records
- Update record payloads and status
- Soft-delete/archive app-owned work-product records
- Attach work product to the current app, firm, and optional client or account context

Builder apps **may not**:

- Overwrite immutable canonical reference facts through this contract
- Create canonical households, clients, accounts, positions, transactions, cost basis, restricted PII, account-owner links, or import jobs through this contract
- Create canonical imports or call custodian/integration apply flows through this contract
- Treat partner-owned reference data as app-owned mutable data
- Claim that app-data records are cross-app portable by default

## Portability rule

PlannerXchange-hosted app-data records are governed and exportable but are not canonical or cross-app portable by default. If PlannerXchange later promotes a record family to canonical data, that happens through an explicit contract change.

## Review implications

### Review remediation checklist

- Confirm source and committed build both use the same supported operation.
- Confirm create includes all required fields and update includes at least one
  of `title`, `status`, or `payload`.
- Confirm response data is read from `items` and `payload`, never `.value`.
- Confirm every record-level route uses a server-issued record ID.
- It is valid to parse a list response in a local generic JSON helper, filter or
  sort `page.items`, return the selected record, and cache that record in browser
  memory. Keep the helper return expression and later `recordId` access
  statically traceable; do not replace the server ID with the cache key.
- Keep routes, methods, request objects, type aliases, and spreads statically
  resolvable. `dynamic_request_contract` is a builder finding: replace an
  untyped/dynamic method or body with a literal or statically typed request.
  `request_shape_resolution_unavailable` is a PlannerXchange processing failure,
  not an instruction to redesign a valid app.
- Source and committed-build operations are matched independently. A committed
  operation can resolve only a sole scanner uncertainty about server-issued ID
  provenance when it is the one unique compatible operation and independently
  proves an app-data response ID. If review instead reports another unresolved
  adapter/request shape or a proven invalid request, follow that exact diagnosis
  rather than assuming the artifact overrides it.
- For a dynamic create finding, use a literal or statically typed body containing
  required `recordType`, `status`, `schemaVersion`, and object `payload` fields.
  For a dynamic update finding, send at least one of `title`, `status`, or
  `payload` with a server-issued record ID.
- Rebuild and commit production output and provenance after source changes.

Apps using app-data writes should expect publication review for:

- Scope minimization — does the app request more write access than it needs?
- Firm-boundary compliance — does data stay within the correct `firmId`?
- Source-reference integrity — are `sourceRefs` populated for traceability?
- Sensitive-data handling — is client PII stored appropriately?
- Auditability — can the record trail be reconstructed?

Day 1 rule: external AI-provider or third-party egress of PX client data is not allowed.
