# Data Contract Notes

Use these rules while building:

- treat PlannerXchange as the source of auth and session context
- consume runtime context from the shell/plugin contract
- do not invent separate planner identity or tenant models
- do not treat firm creation, user creation, invitation acceptance, membership assignment, invite-link handling, email verification, or initial password setup as app-owned builder responsibilities
- assume PX canonical data contracts and governed APIs are stricter than standalone frontend code
- decide early whether the app is `plannerxchange_portable` or `app_managed_nonportable`

Current practical reality:

- lightweight apps can be mostly frontend-first
- richer PX-data workflows will depend on PlannerXchange APIs
- if the app only needs a simple calculator or worksheet, keep it lightweight
- builder apps primarily consume PX runtime context and approved data reads; they do not provision firms or users

If the app is `plannerxchange_portable`:

- use PlannerXchange-governed APIs for PX canonical data
- use approved PX app-data APIs for builder-owned work product when the app needs to save recommendations, scenarios, questionnaire responses, projections, or similar records inside PX
- treat `firmId` as the maximum data boundary
- builders may add stricter intra-firm scoping such as per-`advisor_user` access
- expect stricter review for permissions, client-data access, and external egress
- do not assume app-owned direct database access for PX canonical data
- do not assume raw KMS access or direct decrypt capability
- do not persist decrypted PX client data in local storage, IndexedDB, analytics beacons, or client-side logs

If the app is `app_managed_nonportable`:

- you may use your own backend or partner-managed systems for app-owned data
- you may also use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
- you may still read approved PX canonical data through PX APIs by default when the app needs it for runtime behavior
- you still must pass PlannerXchange security and publication review
- do not request PX client-data scopes unless the app truly needs PX canonical client or account data
- label the app honestly as app-managed rather than portable
- app-owned data is not eligible for the PX portability contract

Use these provenance buckets:

- PX canonical data
  - data that should follow the firm across multiple apps

- app-owned data
  - app-specific workflow state, derived outputs, or proprietary records that do not need to become portable

- integration-exposed data
  - partner-system data that remains in the third-party system but is surfaced through PlannerXchange-governed integrations

Rule:

- if a field should follow the firm across apps, it should move into a PX canonical or approved integration-exposed contract instead of staying app-local only
- PX-hosted app-owned work product does not become canonical or portable by default just because PX stores it

Reference facts versus work product:

- immutable PX reference facts such as account identifiers, positions, and transactions should not be treated as app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, and projections should be saved separately through approved PX app-data APIs or explicit app-owned persistence

Worked patterns:

1. PX client data plus PX app-data
   Rebalancer app reads PX canonical client and account summaries, then saves `recommendation_set` records through PX app-data. The recommendations are governed and exportable, but they are not canonical across apps by default.
2. Partner data plus PX app-data
   Cashflow app reads Plaid or other partner data through PX-governed integration paths, then saves `projection_run` records through PX app-data. The partner facts stay partner-sourced; the projections are builder-owned work product.
3. App-managed nonportable
   Marketing or content app may use no PX client data at all and may keep its own outputs in app-owned storage. It can still publish through PlannerXchange, but it should not imply its app-owned data is portable.

Provenance-aware UI guidance:

- show where a record came from, such as PX canonical data, partner integration, manual entry, or app upload
- show the `asOf` date when the app is rendering partner-sourced or imported information
- keep partner-sourced labels visible so users do not confuse third-party reference facts with app-authored recommendations or projections

Outbound email guidance:

- if the app needs to send transactional email (questionnaire links, workflow confirmations, report delivery), declare `email.send` in the manifest `permissions` array
- call `POST /app-email/send` through the PlannerXchange API — the app never holds sending credentials
- PlannerXchange resolves the sending identity: firm-verified address if configured, otherwise `noreply@plannerxchange.ai`
- do not use the outbound email API for identity invitations, verification links, password setup, password reset, or onboarding access links; those are PlannerXchange-owned auth flows
- pass the recipient's email from PX canonical client data when available; require `canonical.client.sensitive.read` if the app auto-fills the email from PX canonical client detail
- pass `clientUserId` and `appRecordId` in the email request for audit traceability
- the reply-to address defaults to the active user's email; override it explicitly if the firm wants replies routed elsewhere
- PlannerXchange appends the firm's disclosure footer to all outbound HTML email automatically
- do not use the email endpoint for bulk marketing, cold outreach, or recurring newsletters unrelated to a specific workflow event
- read `docs/builder-spec/outbound-email-v1.md` for the full contract including rate limits, review requirements, and the Phase 2 linked Gmail/Outlook account path

White-label UI guidance:

- if the app renders its own branded header, nav, summary card, or disclosure area, consume PX branding and legal context instead of hardcoding one static brand
- if the app shows a logo, size it responsively rather than assuming one exact width or aspect ratio
- expect PX branding to include `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, `fontColor`, and `supportEmail`
- missing logo or favicon should not break the app; fall back cleanly to text or a simple mark

Brand asset standards:

- logo: `svg` preferred, transparent `png` fallback, recommended minimum width `512px`, max `1 MB`
- favicon: square `svg`, `png`, or `ico`, recommended raster minimum `256x256`, max `256 KB`
- colors: use hex values and expect a platform-provided `fontColor` when the app renders colored surfaces

Before adding data writes, decide:

1. Is this PX canonical data or app-owned / partner-managed data?
2. If it is PX canonical data, is it an immutable reference fact that should remain read-only, or an explicitly approved PX write contract?
3. If it is app-owned or partner-managed, is this app intentionally `app_managed_nonportable`?
4. Does this app need client-level access, account-level access, or only firm/advisor context?
5. Does the builder want stricter sub-scoping inside the firm?
6. Should that stricter sub-scoping be configurable by the firm or user path rather than hardcoded?

---

## Canonical data available out-of-the-box

PlannerXchange manages canonical firm data that apps can read through governed APIs. Firms import this data through CSV uploads or manual entry in the PlannerXchange shell. Builder apps do not need to import, transform, or store this data — they read it from the platform.

### Entity hierarchy

```text
firm
  → household
    → client (one or more per household)
    → account (belongs to one household; may have multiple client owners)
      → position (point-in-time holdings; date-specific)
      → transaction (activity records; date-specific)
      → cost_basis (tax-lot records; date-specific)
  → model (target allocation template)
    → model_holding (security + weight)
  → sleeve (composite of models)
    → sleeve_allocation (model + weight)

platform (global, shared across all firms)
  → security (security master; firms can overlay with overrides)
```

### Household tax data direction

PlannerXchange is expanding canonical household data with year-scoped household tax filing records.

Modeling rules:

- treat household tax data as filing records, not as many extra fields on the household root
- one household may have many tax filings across years
- one household may have more than one filing for the same tax year when filing units differ

Planned filing shape:

- filing identity: `id`, `householdId`, `taxYear`, `filingUnitKey`, `filingScope`, `filingStatus`
- taxpayer references: `primaryClientId`, optional `secondaryClientId`
- source metadata: `sourceType`, `sourceSystem`, `sourceSyncStatus`, `sourceLastSyncedAt`
- summary metrics: `totalIncome`, `agi`, `taxableIncome`, `totalTax`, `averageRate`, `marginalBracket`, `marginalCapGainsBracket`
- additional metric groups: income detail, gains and carryovers, deductions, medicare or IRMAA-related values, and advisor or tax notes

Planned builder-facing route direction:

- `GET /canonical/households/{householdId}/tax-filings`
- `GET /canonical/households/{householdId}/tax-filings/{taxFilingId}`

Planned scope direction:

- `canonical.tax.summary.read`
- `canonical.tax.detail.read`

### External identity direction

PlannerXchange canonical entities may carry external identity in more than one way.

Current practical rule:

- `household`, `client`, and `account` payloads may expose an optional root `externalId`
- treat that field as a single convenience reference only

Portable integration rule:

- external identity should be treated as provider-scoped and potentially plural
- the same household may map to more than one partner system
- the same client may map to more than one partner system
- the same account may map to more than one partner or custodian system

Builder guidance:

- do not assume root `externalId` identifies the provider
- do not assume root `externalId` is the only durable join key for partner-aware workflows
- design integration-aware apps so provider-specific external mappings can be modeled separately from the canonical root record

### Permission scopes

Declare these in the manifest `permissions` array. Only request what the app actually needs.

| Scope | Grants access to |
|-------|-----------------|
| `canonical.household.read` | Household list and detail |
| `canonical.client.summary.read` | Client list with display name, status, flags — no raw PII |
| `canonical.client.sensitive.read` | Full client detail including name, DOB, email, phone, and address |
| `canonical.account.read` | Account list, detail, and balance |
| `canonical.position.read` | Positions within an account |
| `canonical.transaction.read` | Transactions within an account |
| `canonical.cost_basis.read` | Cost basis lots within an account |
| `canonical.security.read` | Platform security master with firm overrides merged |
| `canonical.model.read` | Models and their holdings |
| `canonical.sleeve.read` | Sleeves and sleeve allocations |

### Installed-app request transport

All builder-facing canonical routes require:

- the active session bearer token
- `x-plannerxchange-app-installation-id` sourced from `ShellRuntimeContext.appInstallationId`

Temporary compatibility note:

- `appInstallationId` query-string fallback may still work in some routes while SDK helpers stay minimal
- student builders should treat the header as the required path for new code

Shell-only boundary:

- CSV import, custom-field admin, category mappings, security-allocation editing, and auto-classify are shell-owned workflows
- student apps should only target the documented canonical read routes below unless PlannerXchange later publishes a new builder-facing contract

### API routes

All routes require the active session token. Responses are scoped to the current firm. Non-admin advisors see only assigned data.

| Route | Scope | Description |
|-------|-------|-------------|
| `GET /canonical/households` | `canonical.household.read` | List households |
| `GET /canonical/households/{householdId}` | `canonical.household.read` | Household detail |
| `GET /canonical/clients` | `canonical.client.summary.read` | List clients (summary) |
| `GET /canonical/households/{householdId}/clients` | `canonical.client.summary.read` | Clients in a household |
| `GET /canonical/households/{householdId}/clients/{clientId}` | `canonical.client.sensitive.read` | Full client detail |
| `GET /canonical/accounts` | `canonical.account.read` | List accounts |
| `GET /canonical/households/{householdId}/accounts` | `canonical.account.read` | Accounts in a household |
| `GET /canonical/accounts/{accountId}` | `canonical.account.read` | Account detail |
| `GET /canonical/accounts/{accountId}/positions` | `canonical.position.read` | Positions (filter by `asOfDate`) |
| `GET /canonical/accounts/{accountId}/transactions` | `canonical.transaction.read` | Transactions (filter by `startDate`, `endDate`) |
| `GET /canonical/accounts/{accountId}/cost-basis` | `canonical.cost_basis.read` | Cost basis lots (filter by `asOfDate`) |
| `GET /canonical/securities` | `canonical.security.read` | Securities (merged with firm overrides) |
| `GET /canonical/securities/{securityId}` | `canonical.security.read` | Security detail (merged) |
| `GET /canonical/models` | `canonical.model.read` | Models list |
| `GET /canonical/models/{modelId}/holdings` | `canonical.model.read` | Model holdings |
| `GET /canonical/sleeves` | `canonical.sleeve.read` | Sleeves list |
| `GET /canonical/sleeves/{sleeveId}/allocations` | `canonical.sleeve.read` | Sleeve allocations |

### Pagination

All list routes accept `limit` (default 25, max 100) and `cursor` for pagination. Response includes `pageInfo.nextCursor`.

### Common query parameters

| Param | Applies to | Description |
|-------|-----------|-------------|
| `status` | Households, clients, accounts | Filter by status |
| `householdId` | Clients, accounts | Filter by household |
| `asOfDate` | Positions, cost basis | Filter by as-of date |
| `startDate` | Transactions | Inclusive start of date range |
| `endDate` | Transactions | Inclusive end of date range |
| `search` | Households, accounts, securities | Text search on name/ticker |

### Key fields by entity (required vs optional)

Fields marked **required** are guaranteed non-null on every record. Optional fields may be null. Handle null gracefully for all optional fields.

**Household:** `id`, `name`, `status` are required. `externalId`, `taxFilingStatus`, `taxState`, `notes`, `assignedAdvisorUserIds`, `customFields` are optional.

When household tax data is exposed through canonical APIs, treat it as separate household tax-filing records rather than assuming all tax values live directly on the household object.

**Client (summary):** `id`, `householdId`, `displayName`, `status` are returned. Raw PII fields require `canonical.client.sensitive.read`.

**Client (sensitive):** `firstName`, `lastName` are required. `dateOfBirth`, `emailPrimary`, `phonePrimary`, and address fields are optional. `externalId` may be present as a single convenience reference. `ssnTin` is not returned in builder-facing canonical API responses.

**Account:** `id`, `householdId`, `accountNumber`, `accountName`, `accountStatus`, `ownerClientIds` are required. `custodianName`, `accountType`, `taxType`, `accountBalance`, `balanceAsOfDate`, and `externalId` are optional.

`accountNumber` should be treated as masked display data by default. Student apps should not assume full account numbers are available or render any account number field as raw unmasked text.

**Position:** `id`, `accountId`, `asOfDate` are required. At least one of `symbol`/`cusip` is present. `quantity`, `price`, `marketValue`, `securityName`, `securityType` are optional.

**Transaction:** `id`, `accountId`, `date` are required. `symbol`, `cusip`, `description`, `amount`, `quantity`, `price`, `displayTransactionType`, `detailedTransactionType`, `tradeDate`, `settleDate`, `netAmount`, `fees`, `commission`, `status` are optional.

**Cost basis:** `id`, `accountId`, `asOfDate` are required. `symbol`, `cusip`, `description`, `acquisitionDate`, `quantity`, `costBasisAmount`, `currentValue`, `gainLoss`, `holdingPeriod`, `lotId` are optional.

**Security:** `id`, `securityName`, `status`, `verificationStatus` are required. `ticker`, `cusip`, `symbol`, `securityType`, `fees` are optional. When a firm override exists, `displayName`, `returnExpectation`, `assetClassId`, `benchmark` are included in a `firmOverride` object.

**Model:** `id`, `name`, `status` are required. `description`, `assetManager` are optional. Holdings are read from the separate `/canonical/models/{modelId}/holdings` route.

**Sleeve:** `id`, `name`, `status` are required. `description` is optional. Allocation responses include `{ modelId, weight }` items.

### Rules for builder apps consuming canonical data

- canonical data is read-only for builder apps in v1
- do not attempt to create, update, or delete canonical records — those operations belong to the PlannerXchange shell
- if the app needs to save derived work product (recommendations, projections, scenarios), use the PX app-data API (see `docs/builder-spec/app-data-api-v1.md`)
- app requests should always include `x-plannerxchange-app-installation-id` from the shell runtime context
- do not cache canonical data in IndexedDB or long-lived local storage — re-fetch from the API to ensure freshness
- do not export or send PX canonical client data to external AI providers or third parties in Day 1
- handle null on all optional fields — not every firm imports every field, and different custodian exports include different columns
- firms populate canonical data through PlannerXchange's CSV import wizard, which supports common custodian formats (Altruist, Schwab, Fidelity, etc.) with fuzzy column matching — but data completeness depends on what the firm uploaded
- respect `verificationStatus` on securities: `unverified` or `review_needed` securities may have incomplete or incorrect metadata
- do not build student-app workflows around shell-only canonical admin routes such as import setup, custom fields, category mappings, or auto-classify
- if the app renders household or account totals, the firm's data may be partial — do not imply completeness unless the firm confirms it
