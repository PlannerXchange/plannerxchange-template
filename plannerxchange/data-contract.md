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

- you may use app-owned storage only for public demos, external-showcase behavior, app-owned non-PX data, or a separately approved enterprise exception
- you may also use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
- you may still read approved PX runtime, branding, legal, and other allowed APIs through PX interfaces
- you should not request PX canonical client/account/transaction scopes unless the app truly needs them and can pass elevated review
- you still must pass PlannerXchange security and publication review
- do not use builder-owned database clients, ORM clients, service-role keys, database URL env vars, or app-managed API backends for PX/client/subscriber data in the normal self-serve shell-published path
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

- immutable PX reference facts such as account identifiers, positions, transactions, and cost-basis lots should not be treated as app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, projections, transaction-category rule sets, category assignment sets, cashflow projection runs, and app-owned upload row sets should be saved separately through approved PX app-data APIs
- client-, household-, or account-linked app-data must use top-level `clientUserId`, `householdId`, `accountId`, or `sourceRefs`; putting `clientId` only inside `payload` is not enough for PlannerXchange governance, filtering, export, lifecycle, or support workflows
- app-data remains builder-owned work product, not a canonical client mutation, even when it is linked to a client
- current PX backend does not expose first-class canonical chart-of-accounts or transaction-category-rule mutation; app-data categorization records do not mutate canonical transactions and are not cross-app portable by default

CSV and file ingress:

- declare CSV/file/API ingress with `dataIngressDeclarations` in `plannerxchange.app.json`
- app-owned CSV outputs may become PX app-data records when they are builder-owned work product
- canonical imports, including position, transaction, and cost-basis CSV imports, must use PlannerXchange-owned Core Data import handling
- do not call provider OAuth `/integrations/*`, hard-delete/cleanup routes, platform-only import routes, or undocumented canonical write/import routes directly from app code
- do not auto-create canonical households, clients, accounts, account-owner links, positions, transactions, cost basis, restricted PII, or import jobs from app-managed CSV logic outside the governed PX import handoff and canonical write contracts
- every canonical transaction import row must resolve to a canonical account, and every account must resolve to a household, through PX-owned matching and review
- ambiguous or unmatched parent records stay staged for PX review, correction, skip, or accepted stub creation; app code should not write orphan canonical records
- if an app supports its own CSV workflow, keep the result in app-data as derived work product or hand canonical Core Data import back to PlannerXchange; do not persist raw PX client, account, custodian, transaction, or tax-lot data in browser storage or app-local storage

Worked patterns:

1. PX client data plus PX app-data
   Rebalancer app reads PX canonical client and account summaries, then saves `recommendation_set` records through PX app-data. The recommendations are governed and exportable, but they are not canonical across apps by default.
2. Partner data plus PX app-data
   Cashflow app reads approved partner-sourced data through PX-governed integration paths, then saves `projection_run` records through PX app-data. The partner facts stay partner-sourced; the projections are builder-owned work product.
3. App-managed nonportable
   Marketing or content app may use no PX client data at all and may keep its own outputs in app-owned storage. It can still publish through PlannerXchange, but it should not imply its app-owned data is portable.
4. Cashflow CSV categorization
   Cashflow app accepts transaction-like CSV rows, creates `transaction_category_rule_set`, `transaction_category_assignment_set`, `cashflow_projection_run`, or `cashflow_upload_row_set` app-data records, and links them to canonical transactions or accounts through `sourceRefs`. These app-data records do not create or update canonical transactions.

Provenance-aware UI guidance:

- show where a record came from, such as PX canonical data, partner integration, manual entry, or app upload
- show the `asOf` date when the app is rendering partner-sourced or imported information
- keep partner-sourced labels visible so users do not confuse third-party reference facts with app-authored recommendations or projections

Outbound email guidance:

- if the app needs to send transactional email (questionnaire links, workflow confirmations, report delivery), declare `email.send` in the manifest `permissions` array
- call `POST /app-email/send` through the PlannerXchange API Ã¢â‚¬â€ the app never holds sending credentials
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
- in production, the PlannerXchange shell may be accessed from different browsers, devices, or by different firm members â€” browser-local state is invisible to other sessions
- any data that should survive across sessions or be visible to other firm users must be persisted through the PX app-data API (`app_data.read` / `app_data.write` scopes)
- shareable links, saved reports, and workflow state all require server-side persistence via PX app-data
- if the app uses `localStorage` for caching or UI preferences, clearly separate that from record persistence and do not let it become the primary data store

Before adding data writes, decide:

1. Is this PX canonical data or app-owned / partner-managed data?
2. If it is PX canonical data, is it an imported/reference fact that should remain read-only, or an explicitly approved PX write contract?
3. If it is app-owned or partner-managed, is this app intentionally `app_managed_nonportable`?
4. Does this app need client-level access, account-level access, or only firm/advisor context?
5. Does the builder want stricter sub-scoping inside the firm?
6. Should that stricter sub-scoping be configurable by the firm or user path rather than hardcoded?

---

## Canonical data available out-of-the-box

PlannerXchange manages canonical firm data that apps can read through governed APIs. Firms import this data through CSV uploads or manual entry in the PlannerXchange shell. Builder apps do not need to import, transform, or store this data Ã¢â‚¬â€ they read it from the platform.

### Entity hierarchy

```text
firm
  Ã¢â€ â€™ household
    Ã¢â€ â€™ client (one or more per household)
    Ã¢â€ â€™ account (belongs to one household; may have multiple client owners)
      Ã¢â€ â€™ position (point-in-time holdings; date-specific)
      Ã¢â€ â€™ transaction (activity records; date-specific)
      Ã¢â€ â€™ cost_basis (tax-lot records; date-specific)
  Ã¢â€ â€™ model (target allocation template)
    Ã¢â€ â€™ model_holding (security + weight)
  Ã¢â€ â€™ sleeve (composite of models)
    Ã¢â€ â€™ sleeve_allocation (model + weight)

platform (global, shared across all firms)
  Ã¢â€ â€™ security (security master; firms can overlay with overrides)
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
- latestTaxDataSource = tax_provider
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
| `canonical.household.write` | Household create, update, and soft-delete |
| `canonical.client.summary.read` | Client list with display name, status, flags Ã¢â‚¬â€ no raw PII |
| `canonical.client.sensitive.read` | Full client detail including name, DOB, email, phone, and address |
| `canonical.client.write` | Client create, update, and soft-delete |
| `canonical.account.read` | Account list, detail, and balance |
| `canonical.account.write` | Account create, update, and soft-delete with protected account identifiers |
| `canonical.position.read` | Firm-wide and account-scoped positions |
| `canonical.transaction.read` | Firm-wide and account-scoped transactions |
| `canonical.cost_basis.read` | Firm-wide and account-scoped cost basis lots |
| `canonical.security.read` | Platform security master with firm overrides merged |
| `canonical.security.firm_override` | Firm security overrides and security allocations |
| `canonical.asset_class.write` | Asset class reference data create, update, and soft-delete |
| `canonical.category_mapping.write` | Category mapping updates |
| `canonical.custom_field.write` | Custom field definition create, update, and soft-delete |
| `canonical.model.read` | Models and their holdings |
| `canonical.model.write` | Model mutation route families when exposed |
| `canonical.sleeve.read` | Sleeves and sleeve allocations |
| `canonical.crm_note.read` | Synced CRM notes normalized by PlannerXchange |
| `canonical.crm_task.read` | Synced CRM tasks normalized by PlannerXchange |
| `canonical.tax.summary.read` | Household tax status and tax-summary fields on households |
| `canonical.tax.detail.read` | Household tax-filing records by year and filing unit |
| `canonical.tax.write` | Household tax-filing create, update, and soft-delete |
| `canonical.integration_link.write` | Entity integration-link create, update, and soft-delete, excluding provider OAuth secrets |
| `canonical.import.read` | PlannerXchange-owned Core Data import handoff/job state |
| `canonical.import.write` | PlannerXchange-owned Core Data import handoff/workflow routes, not direct database writes |

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

- hard-delete, purge, retention cleanup, destructive repair, and auto-classify are shell-owned workflows
- partner connection, OAuth, credential entry, sync/import jobs, and match-review workflows under `/integrations/*` are shell-owned workflows
- student apps should target documented canonical read and governed write routes only; direct persistence access is never part of the builder contract
- synced CRM routes return only matched PlannerXchange-normalized records; unmatched CRM staging records, match candidates, and partner-import job progress are not builder-facing app data

### API routes

All routes require the active session token. Responses are scoped to the current firm. Non-admin advisors see only assigned data.

Builder docs still use the intended `/canonical/*` namespace below.

Current live platform route registration is root-scoped for canonical reads. If your app is calling the live backend today, use the current live route paths in the second column.

| Builder-doc route | Current live route | Scope | Status | Description |
|-------------------|--------------------|-------|--------|-------------|
| `GET /canonical/households` | `GET /households` | `canonical.household.read` | live | List households |
| `GET /canonical/households/{householdId}` | `GET /households/{householdId}` | `canonical.household.read` | live | Household detail |
| `POST /canonical/households` | `POST /households` | `canonical.household.write` | live | Create household |
| `PATCH /canonical/households/{householdId}` | `PATCH /households/{householdId}` | `canonical.household.write` | live | Update household; requires `If-Match` |
| `DELETE /canonical/households/{householdId}` | `DELETE /households/{householdId}` | `canonical.household.write` | live | Soft-delete household; requires `If-Match` |
| `GET /canonical/households/{householdId}/tax-filings` | `GET /households/{householdId}/tax-filings` | `canonical.tax.detail.read` | live | Household tax filings by year and filing unit |
| `GET /canonical/households/{householdId}/tax-filings/{taxFilingId}` | `GET /households/{householdId}/tax-filings/{taxFilingId}` | `canonical.tax.detail.read` | live | Single household tax filing detail |
| `POST /canonical/households/{householdId}/tax-filings` | `POST /households/{householdId}/tax-filings` | `canonical.tax.write` | live | Create household tax filing |
| `PATCH /canonical/households/{householdId}/tax-filings/{taxFilingId}` | `PATCH /households/{householdId}/tax-filings/{taxFilingId}` | `canonical.tax.write` | live | Update household tax filing; requires `If-Match` |
| `DELETE /canonical/households/{householdId}/tax-filings/{taxFilingId}` | `DELETE /households/{householdId}/tax-filings/{taxFilingId}` | `canonical.tax.write` | live | Soft-delete household tax filing; requires `If-Match` |
| `GET /canonical/clients` | `GET /clients` | `canonical.client.summary.read` | live | List clients (summary) |
| `GET /canonical/households/{householdId}/clients` | `GET /households/{householdId}/clients` | `canonical.client.summary.read` | live | Clients in a household |
| `GET /canonical/households/{householdId}/clients/{clientId}` | `GET /households/{householdId}/clients/{clientId}` | `canonical.client.sensitive.read` | live | Full client detail |
| `POST /canonical/households/{householdId}/clients` | `POST /households/{householdId}/clients` | `canonical.client.write` | live | Create client |
| `PATCH /canonical/households/{householdId}/clients/{clientId}` | `PATCH /households/{householdId}/clients/{clientId}` | `canonical.client.write` | live | Update client; requires `If-Match` |
| `DELETE /canonical/households/{householdId}/clients/{clientId}` | `DELETE /households/{householdId}/clients/{clientId}` | `canonical.client.write` | live | Soft-delete client; requires `If-Match` |
| `GET /canonical/accounts` | `GET /accounts` | `canonical.account.read` | live | List accounts |
| `GET /canonical/households/{householdId}/accounts` | `GET /households/{householdId}/accounts` | `canonical.account.read` | live | Accounts in a household |
| `GET /canonical/accounts/{accountId}` | `GET /accounts/{accountId}` | `canonical.account.read` | live | Account detail |
| `POST /canonical/households/{householdId}/accounts` | `POST /households/{householdId}/accounts` | `canonical.account.write` | live | Create account |
| `PATCH /canonical/households/{householdId}/accounts/{accountId}` | `PATCH /households/{householdId}/accounts/{accountId}` | `canonical.account.write` | live | Update account; requires `If-Match` |
| `DELETE /canonical/households/{householdId}/accounts/{accountId}` | `DELETE /households/{householdId}/accounts/{accountId}` | `canonical.account.write` | live | Soft-delete account and portfolio children; requires `If-Match` |
| `GET /canonical/positions` | `GET /positions` | `canonical.position.read` | live | Firm-wide positions (default latest `asOfDate`, S3-backed cursor) |
| `GET /canonical/transactions` | `GET /transactions` | `canonical.transaction.read` | live | Firm-wide transactions (newest activity first, S3-backed cursor) |
| `GET /canonical/cost-basis` | `GET /cost-basis` | `canonical.cost_basis.read` | live | Firm-wide cost basis lots (default latest `asOfDate`, S3-backed cursor) |
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

All list routes accept `limit` and `cursor` for pagination. Response includes `pageInfo.nextCursor`.

Top-level portfolio routes (`/positions`, `/transactions`, `/cost-basis`) default to `limit=10` with max `100`. Their cursors may represent S3 shard offsets, so pass the cursor back unchanged and do not parse it.

Most other canonical list routes default to `limit=25` with max `100`.

### Common query parameters

| Param | Applies to | Description |
|-------|-----------|-------------|
| `status` | Households, clients, accounts | Filter by status |
| `householdId` | Clients, accounts | Filter by household |
| `accountId` | Top-level portfolio routes | Filter by account |
| `asOfDate` | Positions, cost basis | Filter by as-of date |
| `startDate` | Transactions | Inclusive start of date range |
| `endDate` | Transactions | Inclusive end of date range |
| `symbol` | Positions, transactions, cost basis | Filter by security symbol |
| `cusip` | Positions, transactions, cost basis | Filter by CUSIP |
| `sourceSystem` | Positions, transactions, cost basis | Filter by source system such as `csv` or a provider-derived source |
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

**Position:** `id`, `accountId`, `asOfDate` are required. At least one of `symbol`/`cusip` is present. `quantity`, `price`, `marketValue`, `currencyCode`, `securityName`, `securityType`, `sourceSystem`, and `importedAt` are optional.

**Transaction:** `id`, `accountId`, `date` are required. `asOfDate`, `symbol`, `cusip`, `description`, `amount`, `quantity`, `price`, `currencyCode`, `displayTransactionType`, `detailedTransactionType`, `tradeDate`, `settleDate`, `netAmount`, `fees`, `commission`, `status`, `sourceSystem`, and `importedAt` are optional.

**Cost basis:** `id`, `accountId`, `asOfDate` are required. `symbol`, `cusip`, `description`, `acquisitionDate`, `quantity`, `costBasisAmount`, `costBasisUnadjusted`, `costBasisAdjusted`, `currentValue`, `marketValue`, `gainLoss`, `unrealizedGainLoss`, `holdingPeriod`, `sourceSystem`, and `importedAt` are optional.

Position, transaction, and cost-basis data may come from large S3-backed PlannerXchange canonical shards. Apps should read it only through canonical APIs and should not persist raw tax-lot identifiers, provider account identifiers, raw custodian record IDs, or unreconciled custodian payloads in app-local state.

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
  "latestTaxDataSource": "tax_provider",
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
  "sourceSystem": "tax_provider",
  "sourceRecordType": "income_tax",
  "sourceRecordId": "tax_provider_income_tax_987",
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

**Client (summary view Ã¢â‚¬â€ `canonical.client.summary.read`):**

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

**Client (sensitive view Ã¢â‚¬â€ `canonical.client.sensitive.read`):**

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
  "custodianName": "Example Custodian",
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
  "marketValue": 17850.00,
  "currencyCode": "USD",
  "sourceSystem": "csv",
  "importedAt": "2026-05-06T14:00:00Z"
}
```

**Transaction:**

```json
{
  "id": "txn_abc123",
  "accountId": "acct_abc123",
  "date": "2026-03-15",
  "asOfDate": "2026-03-15",
  "displayTransactionType": "Buy",
  "detailedTransactionType": "BUY",
  "symbol": "AAPL",
  "description": "Buy 50 shares AAPL",
  "quantity": 50,
  "price": 175.00,
  "amount": -8750.00,
  "currencyCode": "USD",
  "settleDate": "2026-03-17",
  "sourceSystem": "csv",
  "importedAt": "2026-05-06T14:00:00Z",
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
  "costBasisUnadjusted": 7500.00,
  "costBasisAdjusted": 7400.00,
  "currentValue": 8925.00,
  "marketValue": 8925.00,
  "gainLoss": 1425.00,
  "unrealizedGainLoss": 1425.00,
  "sourceSystem": "csv",
  "importedAt": "2026-05-06T14:00:00Z",
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

- canonical data is shared PX shell data, not app-local state
- create, update, and soft-delete canonical records only through documented governed route contracts and matching `canonical.*.write` scopes
- do not invent undocumented builder routes; if a route family is not listed here or in `api-reference.md`, treat it as unavailable
- canonical `DELETE` means soft-delete only; hard-delete, purge, merge, provider-secret management, and platform cleanup are not builder-facing capabilities
- single-record canonical `PATCH` and `DELETE` require `If-Match` with the last observed `updatedAt`
- handle `missing_scope`, `field_not_allowed`, `precondition_required`, `write_conflict`, and `unsupported_route` as normal API states in the UI
- if the app needs to save derived work product (recommendations, projections, scenarios), use the PX app-data API (see `docs/builder-spec/app-data-api-v1.md`)
- app requests should always include `x-plannerxchange-app-installation-id` from the shell runtime context
- a bearer token plus API base URL is not enough by itself for installed-app canonical behavior; live calls also need a real PlannerXchange installation context
- do not pass `appInstallationId` in query strings or manually construct PlannerXchange auth headers; use `ShellRuntimeContext.authenticatedFetch`
- do not cache canonical data in IndexedDB or long-lived local storage Ã¢â‚¬â€ re-fetch from the API to ensure freshness
- do not export or send PX canonical client data to external AI providers or third parties in Day 1
- handle null on all optional fields Ã¢â‚¬â€ not every firm imports every field, and different custodian exports include different columns
- firms populate canonical data through PlannerXchange's CSV import wizard, which supports common custodian formats with fuzzy column matching Ã¢â‚¬â€ but data completeness depends on what the firm uploaded
- respect `verificationStatus` on securities: `unverified` or `review_needed` securities may have incomplete or incorrect metadata
- do not build student-app workflows around platform-only routes such as hard-delete cleanup, provider OAuth secret management, destructive import repair, or auto-classify
- if the app renders household or account totals, the firm's data may be partial Ã¢â‚¬â€ do not imply completeness unless the firm confirms it
