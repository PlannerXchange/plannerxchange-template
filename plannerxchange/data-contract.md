# Data Contract Notes

Use these rules while building:

- treat PlannerXchange as the source of auth and session context
- consume runtime context from the shell/plugin contract
- do not invent separate planner identity or tenant models
- do not treat firm creation, user creation, invitation acceptance, membership assignment, invite-link handling, email verification, or initial password setup as app-owned builder responsibilities
- assume PX canonical data contracts and governed APIs are stricter than standalone frontend code
- decide early whether the app is `plannerxchange_portable` or `app_managed_nonportable`
- if the app supports public demo mode, keep demo data synthetic and branch on `context.isDemoMode === true`

Current practical reality:

- lightweight apps can be mostly frontend-first
- richer PX-data workflows will depend on PlannerXchange APIs
- if the app only needs a simple calculator or worksheet, keep it lightweight
- builder apps primarily consume PX runtime context and approved data reads; they do not provision firms or users
- public demos receive no real auth token, no real firm/client data, and no canonical API access

If the app is `plannerxchange_portable`:

- use PlannerXchange-governed APIs for PX canonical data
- use approved PX app-data APIs for builder-owned work product when the app needs to save recommendations, scenarios, questionnaire responses, projections, or similar records inside PX
- treat `firmId` as the maximum data boundary
- builders may add stricter intra-firm scoping such as per-`advisor_user` access
- expect stricter review for permissions, client-data access, and external egress
- do not assume app-owned direct database access for PX canonical data
- do not add raw KMS clients, decrypt commands, or app-side restricted-PII decrypt helpers
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
- call `POST /app-email/send` through the PlannerXchange API â€” the app never holds sending credentials
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

Cross-browser and persistence warning:

- `localStorage` and `sessionStorage` are acceptable for mock/demo mode but must never be the production persistence layer
- in production, the PlannerXchange shell may be accessed from different browsers, devices, or by different firm members — browser-local state is invisible to other sessions
- any data that should survive across sessions or be visible to other firm users must be persisted through the PX app-data API (`app_data.read` / `app_data.write` scopes)
- shareable links, saved reports, and workflow state all require server-side persistence via PX app-data
- if the app uses `localStorage` for caching or UI preferences, clearly separate that from record persistence and do not let it become the primary data store

Before adding data writes, decide:

1. Is this PX canonical data or app-owned / partner-managed data?
2. If it is PX canonical data, is it an immutable reference fact that should remain read-only, or an explicitly approved PX write contract?
3. If it is app-owned or partner-managed, is this app intentionally `app_managed_nonportable`?
4. Does this app need client-level access, account-level access, or only firm/advisor context?
5. Does the builder want stricter sub-scoping inside the firm?
6. Should that stricter sub-scoping be configurable by the firm or user path rather than hardcoded?

---

## Canonical data available out-of-the-box

PlannerXchange manages canonical firm data that apps can read through governed APIs. Firms import this data through CSV uploads or manual entry in the PlannerXchange shell. Builder apps do not need to import, transform, or store this data â€” they read it from the platform.

### Entity hierarchy

```text
firm
  â†’ household
    â†’ client (one or more per household)
    â†’ account (belongs to one household; may have multiple client owners)
      â†’ position (point-in-time holdings; date-specific)
      â†’ transaction (activity records; date-specific)
      â†’ cost_basis (tax-lot records; date-specific)
  â†’ model (target allocation template)
    â†’ model_holding (security + weight)
  â†’ sleeve (composite of models)
    â†’ sleeve_allocation (model + weight)

platform (global, shared across all firms)
  â†’ security (security master; firms can overlay with overrides)
```

### Household tax data direction

PlannerXchange canonical household data includes a household-level tax summary plus year-scoped household tax filing records for actual tax data.

Modeling rules:

- treat household tax data as filing records, not as many extra fields on the household root
- one household may have many tax filings across years
- one household may have more than one filing for the same tax year when filing units differ
- use the household root only for quick summary metadata, not as the full tax record

Household tax summary direction:

- household summary fields: `latestTaxYear`, `latestTaxFilingId`, `latestTaxDataSource`, `latestTaxSyncedAt`, `taxDataStatus`
- use these fields for list views, status chips, freshness indicators, and simple household-level filtering
- do not assume they replace the tax-filing records

Canonical tax-filing shape:

- filing identity: `id`, `householdId`, `taxYear`, `filingUnitKey`, `filingScope`, `filingStatus`
- taxpayer references: `primaryClientId`, optional `secondaryClientId`
- source metadata: `sourceType`, `sourceSystem`, `sourceRecordType`, `sourceRecordId`, `sourceSyncStatus`, `sourceLastSyncedAt`
- summary metrics: `totalIncome`, `agi`, `taxableIncome`, `totalTax`, `averageRate`, `marginalBracket`, `marginalCapGainsBracket`
- additional metric groups: income detail, gains and carryovers, deductions, medicare or IRMAA-related values, and advisor or tax notes

Builder-agent guidance:

- use household summary fields when the app needs only a quick tax-status or freshness signal
- use tax-filing routes when the app needs actual tax values, multi-year history, or filing-unit detail
- support more than one filing for the same year by keying off `taxYear` plus `filingUnitKey`, not `taxYear` alone
- treat `filingScope = household_joint` as a household-level joint filing
- treat `filingScope = client_individual` as an individual filing tied to `primaryClientId`
- treat source metadata as provenance, not just decoration; apps should surface whether the record is manual, imported, or integration-synced

Planned builder-facing route direction:

- `GET /canonical/households/{householdId}/tax-filings`
- `GET /canonical/households/{householdId}/tax-filings/{taxFilingId}`

Planned scope direction:

- `canonical.tax.summary.read`
- `canonical.tax.detail.read`

Tax-read patterns builder agents should support:

1. Household overview pattern
   Read household summary fields first, then lazy-load filings only when the user opens a tax-aware view.
2. Tax-year comparison pattern
   Query household tax filings and group them by `taxYear`, then render one or more filing cards per year.
3. Client-aware tax pattern
   For `client_individual` filings, use `primaryClientId` to join the filing back to the household client record before rendering client-specific tax analysis.

Tax-read examples:

```text
household
- latestTaxYear = 2024
- latestTaxDataSource = holistiplan
- latestTaxSyncedAt = 2026-04-01T18:42:00Z
- taxDataStatus = synced

tax filings
- 2024 / joint / married_filing_jointly
- 2023 / joint / married_filing_jointly
- 2022 / client_cl_abc123 / married_filing_separately
- 2022 / client_cl_def456 / married_filing_separately
```

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
| `canonical.client.summary.read` | Client list with display name, status, flags â€” no raw PII |
| `canonical.client.sensitive.read` | Full client detail including name, DOB, email, phone, and address |
| `canonical.account.read` | Account list, detail, and balance |
| `canonical.position.read` | Positions within an account |
| `canonical.transaction.read` | Transactions within an account |
| `canonical.cost_basis.read` | Cost basis lots within an account |
| `canonical.security.read` | Platform security master with firm overrides merged |
| `canonical.model.read` | Models and their holdings |
| `canonical.sleeve.read` | Sleeves and sleeve allocations |
| `canonical.crm_note.read` | Synced CRM notes, including Wealthbox-sourced notes normalized by PlannerXchange |
| `canonical.crm_task.read` | Synced CRM tasks, including Wealthbox-sourced tasks normalized by PlannerXchange |
| `canonical.tax.summary.read` | Household tax status and tax-summary fields on households |
| `canonical.tax.detail.read` | Household tax-filing records by year and filing unit |

### Installed-app request transport

All builder-facing canonical routes require shell-managed transport:

- call protected PlannerXchange APIs through `ShellRuntimeContext.authenticatedFetch`
- the shell-managed fetch attaches the active session auth
- the shell-managed fetch attaches `x-plannerxchange-app-installation-id` for the installed app

Publish-review rule:

- new builder code must not send `appInstallationId` in query strings, route params, or manually assembled URLs
- do not manually read, store, or attach bearer tokens for PlannerXchange API calls
- query-string installation fallback is legacy compatibility only and is treated as a publish-review blocker for student-built apps

Shell-only boundary:

- CSV import, custom-field admin, category mappings, security-allocation editing, and auto-classify are shell-owned workflows
- partner connection, OAuth, credential entry, sync/import jobs, and match-review workflows under `/integrations/*` are shell-owned workflows
- student apps should only target the documented canonical read routes below unless PlannerXchange later publishes a new builder-facing contract
- synced CRM routes return only matched PlannerXchange-normalized records; unmatched Wealthbox staging records, match candidates, and partner-import job progress are not builder-facing app data

### API routes

All routes require the active session token. Responses are scoped to the current firm. Non-admin advisors see only assigned data.

Builder docs still use the intended `/canonical/*` namespace below.

Current live platform route registration is root-scoped for canonical reads. If your app is calling the live backend today, use the current live route paths in the second column.

| Builder-doc route | Current live route | Scope | Status | Description |
|-------------------|--------------------|-------|--------|-------------|
| `GET /canonical/households` | `GET /households` | `canonical.household.read` | live | List households |
| `GET /canonical/households/{householdId}` | `GET /households/{householdId}` | `canonical.household.read` | live | Household detail |
| `GET /canonical/households/{householdId}/tax-filings` | `GET /households/{householdId}/tax-filings` | `canonical.tax.detail.read` | shell-only today | Household tax filings by year and filing unit |
| `GET /canonical/households/{householdId}/tax-filings/{taxFilingId}` | `GET /households/{householdId}/tax-filings/{taxFilingId}` | `canonical.tax.detail.read` | shell-only today | Single household tax filing detail |
| `GET /canonical/clients` | `GET /clients` | `canonical.client.summary.read` | live | List clients (summary) |
| `GET /canonical/households/{householdId}/clients` | `GET /households/{householdId}/clients` | `canonical.client.summary.read` | live | Clients in a household |
| `GET /canonical/households/{householdId}/clients/{clientId}` | `GET /households/{householdId}/clients/{clientId}` | `canonical.client.sensitive.read` | live | Full client detail |
| `GET /canonical/accounts` | `GET /accounts` | `canonical.account.read` | live | List accounts |
| `GET /canonical/households/{householdId}/accounts` | `GET /households/{householdId}/accounts` | `canonical.account.read` | live | Accounts in a household |
| `GET /canonical/accounts/{accountId}` | `GET /accounts/{accountId}` | `canonical.account.read` | live | Account detail |
| `GET /canonical/accounts/{accountId}/positions` | `GET /accounts/{accountId}/positions` | `canonical.position.read` | live | Positions (filter by `asOfDate`) |
| `GET /canonical/accounts/{accountId}/transactions` | `GET /accounts/{accountId}/transactions` | `canonical.transaction.read` | live | Transactions (filter by `startDate`, `endDate`) |
| `GET /canonical/accounts/{accountId}/cost-basis` | `GET /accounts/{accountId}/cost-basis` | `canonical.cost_basis.read` | live | Cost basis lots (filter by `asOfDate`) |
| `GET /canonical/securities` | `GET /securities` | `canonical.security.read` | live | Securities (merged with firm overrides) |
| `GET /canonical/securities/{securityId}` | `GET /securities/{securityId}` | `canonical.security.read` | live | Security detail (merged) |
| `GET /canonical/models` | `GET /models` | `canonical.model.read` | live | Models list |
| `GET /canonical/models/{modelId}/holdings` | `GET /models/{modelId}/holdings` | `canonical.model.read` | live | Model holdings |
| `GET /canonical/sleeves` | `GET /sleeves` | `canonical.sleeve.read` | live | Sleeves list |
| `GET /canonical/sleeves/{sleeveId}/allocations` | `GET /sleeves/{sleeveId}/allocations` | `canonical.sleeve.read` | live | Sleeve allocations |
| `GET /canonical/crm-notes` | `GET /crm-notes` | `canonical.crm_note.read` | live | Synced CRM notes |
| `GET /canonical/crm-notes/{noteId}` | `GET /crm-notes/{noteId}` | `canonical.crm_note.read` | live | Synced CRM note detail |
| `GET /canonical/crm-tasks` | `GET /crm-tasks` | `canonical.crm_task.read` | live | Synced CRM tasks |
| `GET /canonical/crm-tasks/{taskId}` | `GET /crm-tasks/{taskId}` | `canonical.crm_task.read` | live | Synced CRM task detail |

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

**Household:** `id`, `name`, `status` are required. `externalId`, `taxFilingStatus`, `taxState`, `latestTaxYear`, `latestTaxFilingId`, `latestTaxDataSource`, `latestTaxSyncedAt`, `taxDataStatus`, `notes`, `assignedAdvisorUserIds`, `customFields` are optional.

Use the household tax summary fields for lightweight household-level UX, but treat actual tax values as separate household tax-filing records rather than assuming all tax values live directly on the household object.

**Household tax filing:** `id`, `householdId`, `taxYear`, `filingUnitKey`, `filingScope`, `filingStatus` are required. `primaryClientId`, `secondaryClientId`, source metadata fields, tax metrics, and notes are optional. Handle null on all optional tax metrics because firms may have partial tax detail for a given year.

**Client (summary):** `id`, `householdId`, `displayName`, `status` are returned. Raw PII fields require `canonical.client.sensitive.read`.

**Client (sensitive):** `firstName`, `lastName` are required. `dateOfBirth`, `emailPrimary`, `phonePrimary`, and address fields are optional. `externalId` may be present as a single convenience reference. `ssnTin` is not returned in builder-facing canonical API responses.

**Account:** `id`, `householdId`, `accountNumber`, `accountName`, `accountStatus`, `ownerClientIds` are required. `custodianName`, `accountType`, `taxType`, `taxTreatment`, `accountBalance`, `balanceAsOfDate`, and `externalId` are optional.

Use `accountType` for the specific account registration or product type shown by PlannerXchange, such as `INDIVIDUAL`, `JOINT`, or `IRA`. Use `taxTreatment` for the account's tax treatment: `taxable`, `tax_advantaged_pre_tax`, `tax_advantaged_post_tax`, `tax_advantaged_pre_and_post`, or `unknown`. `taxType` is a broader tax category that may also be present: `taxable`, `tax_deferred`, or `tax_exempt`.

Builder apps may show both the specific account type and the tax treatment. For example, an account row or chip may show `INDIVIDUAL` as the account type and `Taxable` as the tax treatment. Do not infer tax treatment from the displayed account type when `taxTreatment` is present.

`accountNumber` should be treated as masked display data by default. Student apps should not assume full account numbers are available or render any account number field as raw unmasked text.

**Position:** `id`, `accountId`, `asOfDate` are required. At least one of `symbol`/`cusip` is present. `quantity`, `price`, `marketValue`, `securityName`, `securityType` are optional.

**Transaction:** `id`, `accountId`, `date` are required. `symbol`, `cusip`, `description`, `amount`, `quantity`, `price`, `displayTransactionType`, `detailedTransactionType`, `tradeDate`, `settleDate`, `netAmount`, `fees`, `commission`, `status` are optional.

**Cost basis:** `id`, `accountId`, `asOfDate` are required. `symbol`, `cusip`, `description`, `acquisitionDate`, `quantity`, `costBasisAmount`, `currentValue`, `gainLoss`, `holdingPeriod`, `lotId` are optional.

Cost-basis data may come from shell-owned custodian imports such as Altruist. Apps should read it only through canonical cost-basis APIs and should not persist tax-lot identifiers, provider account identifiers, or unreconciled custodian payloads in app-local state.

**Security:** `id`, `securityName`, `status`, `verificationStatus` are required. `ticker`, `cusip`, `symbol`, `securityType`, `fees` are optional. When a firm override exists, `displayName`, `returnExpectation`, `assetClassId`, `benchmark` are included in a `firmOverride` object.

**Model:** `id`, `name`, `status` are required. `description`, `assetManager` are optional. Holdings are read from the separate `/canonical/models/{modelId}/holdings` route.

**Sleeve:** `id`, `name`, `status` are required. `description` is optional. Allocation responses include `{ modelId, weight }` items.

### Full JSON response shapes

These are the actual response payloads builder apps receive from each canonical route. All list routes use `{ items: [...], pageInfo: { limit, nextCursor } }`.

**Household:**

```json
{
  "id": "hh_abc123",
  "firmId": "firm_123",
  "name": "Example Household",
  "taxFilingStatus": "married_filing_jointly",
  "taxState": "CA",
  "latestTaxYear": 2024,
  "latestTaxFilingId": "tax_2024_joint",
  "latestTaxDataSource": "holistiplan",
  "latestTaxSyncedAt": "2026-04-01T18:42:00Z",
  "taxDataStatus": "synced",
  "assignedAdvisorUserIds": ["fu_456"],
  "status": "active",
  "customFields": { "riskScore": "7" }
}
```

**Household tax filing:**

```json
{
  "id": "tax_2024_joint",
  "householdId": "hh_abc123",
  "taxYear": 2024,
  "filingUnitKey": "joint",
  "filingScope": "household_joint",
  "filingStatus": "married_filing_jointly",
  "primaryClientId": "cl_abc123",
  "secondaryClientId": "cl_def456",
  "sourceType": "integration_sync",
  "sourceSystem": "holistiplan",
  "sourceRecordType": "income_tax",
  "sourceRecordId": "hp_income_tax_987",
  "sourceSyncStatus": "synced",
  "sourceLastSyncedAt": "2026-04-01T18:42:00Z",
  "totalIncome": 315000.0,
  "agi": 287500.0,
  "taxableIncome": 251400.0,
  "totalTax": 46820.0,
  "averageRate": 0.163,
  "marginalBracket": "24%",
  "marginalCapGainsBracket": "15%",
  "credits": 2000.0,
  "amountYouOwe": 1450.0,
  "taxLetterNote": "Large one-time capital gain in 2024."
}
```

**Client (summary view â€” `canonical.client.summary.read`):**

```json
{
  "id": "cl_abc123",
  "firmId": "firm_123",
  "householdId": "hh_abc123",
  "displayName": "Avery Example",
  "status": "active",
  "summaryFlags": {
    "hasRestrictedPii": true,
    "hasLinkedAccounts": true
  }
}
```

Summary reads do not return raw PII fields.

**Client (sensitive view â€” `canonical.client.sensitive.read`):**

```json
{
  "id": "cl_abc123",
  "firmId": "firm_123",
  "householdId": "hh_abc123",
  "firstName": "Avery",
  "lastName": "Example",
  "dateOfBirth": "1975-06-15",
  "emailPrimary": "avery.example@example.test",
  "phonePrimary": "+15551234567",
  "state": "CA",
  "status": "active",
  "customFields": {}
}
```

`ssnTin` is never returned in builder-facing API responses.

**Account:**

```json
{
  "id": "acct_abc123",
  "firmId": "firm_123",
  "householdId": "hh_abc123",
  "accountNumber": "****5678",
  "accountName": "Example IRA",
  "custodianName": "Schwab",
  "accountType": "IRA",
  "taxType": "tax_deferred",
  "taxTreatment": "tax_advantaged_pre_tax",
  "accountStatus": "active",
  "accountBalance": 250000.00,
  "balanceAsOfDate": "2026-03-20",
  "ownerClientIds": ["cl_abc123"]
}
```

**Position:**

```json
{
  "id": "pos_abc123",
  "accountId": "acct_abc123",
  "asOfDate": "2026-03-20",
  "securityId": "sec_xyz",
  "symbol": "AAPL",
  "cusip": "037833100",
  "securityName": "Apple Inc.",
  "securityType": "equity",
  "quantity": 100,
  "price": 178.50,
  "marketValue": 17850.00
}
```

**Transaction:**

```json
{
  "id": "txn_abc123",
  "accountId": "acct_abc123",
  "date": "2026-03-15",
  "displayTransactionType": "Buy",
  "symbol": "AAPL",
  "description": "Buy 50 shares AAPL",
  "quantity": 50,
  "price": 175.00,
  "amount": -8750.00,
  "status": "settled"
}
```

**Cost basis:**

```json
{
  "id": "cb_abc123",
  "accountId": "acct_abc123",
  "asOfDate": "2026-03-20",
  "symbol": "AAPL",
  "acquisitionDate": "2024-01-15",
  "quantity": 50,
  "costBasisAmount": 7500.00,
  "currentValue": 8925.00,
  "gainLoss": 1425.00,
  "holdingPeriod": "long_term"
}
```

**Security (with firm override):**

```json
{
  "id": "sec_xyz",
  "ticker": "AAPL",
  "cusip": "037833100",
  "securityName": "Apple Inc.",
  "securityType": "equity",
  "status": "active",
  "verificationStatus": "verified",
  "firmOverride": {
    "displayName": "Apple",
    "assetClassId": "ac_us_large_cap",
    "returnExpectation": 0.08,
    "benchmark": "SPY"
  }
}
```

`firmOverride` is null when the firm has not customized the security. `verificationStatus` values: `verified`, `unverified`, `review_needed`, `unverified_no_match`, `manually_verified`.

**Model:**

```json
{
  "id": "mod_abc123",
  "firmId": "firm_123",
  "name": "60/40 Growth",
  "description": "60% equity, 40% fixed income",
  "assetManager": "In-house",
  "status": "active"
}
```

**Model holding:**

```json
{
  "id": "holding_abc123",
  "modelId": "mod_abc123",
  "securityId": "sec_xyz",
  "ticker": "AAPL",
  "weight": 0.15
}
```

**Sleeve:**

```json
{
  "id": "slv_abc123",
  "firmId": "firm_123",
  "name": "Retirement Sleeve",
  "description": "Composite of retirement-focused models",
  "status": "active"
}
```

**Sleeve allocation:**

```json
{
  "id": "slv_alloc_abc123",
  "sleeveId": "slv_abc123",
  "modelId": "mod_abc123",
  "weight": 0.6
}
```

### Account number masking policy

Account numbers are masked by default for builder apps.

What students should assume:

- the current builder-facing API returns masked `accountNumber` values
- student apps should not build a full-account-number display path unless PlannerXchange explicitly documents one
- if the app computes or combines account identifiers locally, it should still mask them before display

Simple display rule:

```ts
const masked =
  accountNumber.length <= 5 ? accountNumber : `****${accountNumber.slice(-5)}`;
```

**Builder AI agent requirement:** Any field classified `display_sensitive` such as `accountNumber`, `clientSsn`, or `taxId` must be rendered from pre-masked API values or masked before display. Rendering a raw `accountNumber` directly in JSX is a publish review violation.

### Rules for builder apps consuming canonical data

- canonical data is read-only for builder apps in v1
- do not attempt to create, update, or delete canonical records â€” those operations belong to the PlannerXchange shell
- if your UX needs household or client create/edit/archive behavior, do not invent undocumented builder routes; use the current shell-owned workflow or wait for an explicit builder write contract
- if the app needs to save derived work product (recommendations, projections, scenarios), use the PX app-data API (see `docs/builder-spec/app-data-api-v1.md`)
- app requests should always include `x-plannerxchange-app-installation-id` from the shell runtime context
- a bearer token plus API base URL is not enough by itself for installed-app canonical behavior; live calls also need a real PlannerXchange installation context
- do not pass `appInstallationId` in query strings or manually construct PlannerXchange auth headers; use `ShellRuntimeContext.authenticatedFetch`
- do not cache canonical data in IndexedDB or long-lived local storage â€” re-fetch from the API to ensure freshness
- do not export or send PX canonical client data to external AI providers or third parties in Day 1
- handle null on all optional fields â€” not every firm imports every field, and different custodian exports include different columns
- firms populate canonical data through PlannerXchange's CSV import wizard, which supports common custodian formats (Altruist, Schwab, Fidelity, etc.) with fuzzy column matching â€” but data completeness depends on what the firm uploaded
- respect `verificationStatus` on securities: `unverified` or `review_needed` securities may have incomplete or incorrect metadata
- do not build student-app workflows around shell-only canonical admin routes such as import setup, custom fields, category mappings, or auto-classify
- if the app renders household or account totals, the firm's data may be partial â€” do not imply completeness unless the firm confirms it
