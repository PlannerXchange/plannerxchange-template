# Canonical Demo Data

Use `@plannerxchange/demo-data` only in the `public_demo` branch when the
installed app normally reads PX canonical data. The current catalog version is
`px_canonical_demo_v1`; its deterministic scenarios are `smoke`, `standard`,
and `edge`.

The package implements the same `PlannerXchangeCanonicalReadClient` interface
as the authenticated SDK client. It is local, read-only, synthetic,
unauthenticated, and non-persistent. Never use it as an authenticated-runtime
fallback for missing live data.

## Manifest declaration

```json
{
  "permissions": ["canonical.transaction.read"],
  "canonicalDataUsageDeclarations": [
    {
      "id": "transaction-table",
      "catalogVersion": "px_canonical_demo_v1",
      "category": "transactions",
      "object": "transaction",
      "fields": [
        { "path": "date", "uses": ["display", "sort"] },
        { "path": "description", "uses": ["display", "filter"] },
        { "path": "amount", "uses": ["display", "calculation"] }
      ]
    }
  ]
}
```

Allowed `uses` values are `display`, `calculation`, `filter`, `sort`, and
`selection`. This declaration supplies field-level review evidence; it does
not replace exact `permissions` or the category/operation consent contract in
`canonicalDataAccessDeclarations`.

## Catalog

Each row lists `object` -> `category`, required read permission, and supported
field paths. Nested paths must be declared exactly. `customFields` is excluded.

- `household` -> `households`, `canonical.household.read`: `id`, `tenantId`, `enterpriseId`, `firmId`, `name`, `externalId`, `taxFilingStatus`, `taxState`, `latestTaxYear`, `latestTaxFilingId`, `latestTaxDataSource`, `latestTaxSyncedAt`, `taxDataStatus`, `notes`, `assignedAdvisorUserIds`, `status`, `dedupeKey`, `importJobId`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- `client_summary` -> `clients`, `canonical.client.summary.read`: `id`, `firmId`, `householdId`, `householdRole`, `displayName`, `firstName`, `lastName`, `status`, `externalId`, `dedupeKey`, `summaryFlags.hasRestrictedPii`, `summaryFlags.hasLinkedAccounts`, `createdAt`, `updatedAt`.
- `client_detail` -> `clients`, `canonical.client.sensitive.read`: `id`, `tenantId`, `enterpriseId`, `firmId`, `householdId`, `householdRole`, `clientUserId`, `firstName`, `lastName`, `dateOfBirth`, `emailPrimary`, `emailSecondary`, `phonePrimary`, `phoneSecondary`, `addressLine1`, `addressLine2`, `city`, `state`, `zip`, `externalId`, `status`, `dedupeKey`, `importJobId`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- `account` -> `accounts`, `canonical.account.read`: `id`, `tenantId`, `enterpriseId`, `firmId`, `householdId`, `accountNumber`, `accountName`, `custodianName`, `accountType`, `taxType`, `taxTreatment`, `accountStatus`, `openingDate`, `closedDate`, `repCode`, `accountBalance`, `balanceAsOfDate`, `totalCash`, `securityBalance`, `accountCategory`, `accountSource`, `groupName`, `ownerClientIds`, `properties`, `properties.equityDividendReinvestment`, `properties.closedEndMfDividendReinvestment`, `properties.capitalGainsDividendReinvestment`, `properties.dividendReinvestmentAddedDate`, `properties.institutionName`, `properties.docDeliveryConfirms`, `properties.docDeliveryStatements`, `properties.docDeliveryProspectus`, `properties.docDeliveryProxy`, `properties.docDeliveryTaxForms`, `externalId`, `dedupeKey`, `importJobId`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- `position` -> `positions`, `canonical.position.read`: `id`, `tenantId`, `firmId`, `accountId`, `asOfDate`, `securityId`, `cusip`, `symbol`, `securityName`, `securityType`, `currencyCode`, `quantity`, `price`, `marketValue`, `securityFactor`, `repCode`, `dedupeKey`, `createdAt`, `updatedAt`, `sourceSystem`, `importJobId`, `importedAt`, `isDeleted`, `deletedAt`.
- `transaction` -> `transactions`, `canonical.transaction.read`: `id`, `tenantId`, `firmId`, `accountId`, `date`, `asOfDate`, `tradeDate`, `settleDate`, `displayTransactionType`, `detailedTransactionType`, `symbol`, `cusip`, `description`, `status`, `quantity`, `price`, `amount`, `currencyCode`, `netAmount`, `fees`, `commission`, `accountGroup`, `accountType`, `repOnRecord`, `householdName`, `dedupeKey`, `createdAt`, `updatedAt`, `sourceSystem`, `importJobId`, `importedAt`, `isDeleted`, `deletedAt`.
- `cost_basis` -> `cost_basis`, `canonical.cost_basis.read`: `id`, `tenantId`, `firmId`, `accountId`, `symbol`, `cusip`, `description`, `acquisitionDate`, `quantity`, `marketValue`, `costBasisUnadjusted`, `costBasisAdjusted`, `costBasisAmount`, `currentValue`, `gainLoss`, `unrealizedGainLoss`, `holdingPeriod`, `asOfDate`, `dedupeKey`, `createdAt`, `updatedAt`, `sourceSystem`, `importJobId`, `importedAt`, `isDeleted`, `deletedAt`.
- `security` -> `securities`, `canonical.security.read`: `id`, `ticker`, `symbol`, `cusip`, `sedol`, `isin`, `securityName`, `securityType`, `status`, `fees`, `maturityDate`, `yield`, `taxStatus`, `source`, `dedupeKey`, `createdAt`, `updatedAt`, `isDeleted`, `deletedAt`.
- `merged_security` -> `securities`, `canonical.security.read`: every `security` field plus `tickerId`, `firmOverride`, `firmOverride.id`, `firmOverride.firmId`, `firmOverride.securityId`, `firmOverride.tickerId`, `firmOverride.displayName`, `firmOverride.returnExpectation`, `firmOverride.assetClassId`, `firmOverride.benchmark`, `firmOverride.taxLossHarvestReplacement`, `firmOverride.notes`, `firmOverride.createdAt`, `firmOverride.updatedAt`, `firmOverride.createdBy`, `firmOverride.updatedBy`, `pxClassification`, `pxClassification.label`, `pxClassification.isMixed`, `pxClassification.source`, `pxClassification.allocations`, `pxClassification.allocations.assetClassId`, `pxClassification.allocations.assetClassName`, `pxClassification.allocations.percent`, `pxClassification.allocations.path`, `pxClassification.allocations.source`, `firmClassification`, `firmClassification.label`, `firmClassification.isMixed`, `firmClassification.source`, `firmClassification.allocations`, `firmClassification.allocations.assetClassId`, `firmClassification.allocations.assetClassName`, `firmClassification.allocations.percent`, `firmClassification.allocations.path`, `firmClassification.allocations.source`, `resolvedReturnExpectation`, `resolvedReturnExpectation.value`, `resolvedReturnExpectation.source`, `resolvedReturnExpectation.sourceLabel`.
- `model` -> `models`, `canonical.model.read`: `id`, `tenantId`, `firmId`, `name`, `description`, `assetManager`, `status`, `visibility`, `dedupeKey`, `createdAt`, `updatedAt`, `importJobId`, `isDeleted`, `deletedAt`.
- `model_holding` -> `models`, `canonical.model.read`: `id`, `firmId`, `modelId`, `securityId`, `tickerId`, `weight`, `taxSetting`, `createdAt`, `updatedAt`.
- `sleeve` -> `sleeves`, `canonical.sleeve.read`: `id`, `tenantId`, `firmId`, `name`, `description`, `status`, `dedupeKey`, `createdAt`, `updatedAt`, `isDeleted`, `deletedAt`.
- `sleeve_allocation` -> `sleeves`, `canonical.sleeve.read`: `id`, `firmId`, `sleeveId`, `modelId`, `weight`, `taxSetting`, `createdAt`, `updatedAt`.
- `crm_note` -> `crm_notes`, `canonical.crm_note.read`: `id`, `tenantId`, `enterpriseId`, `firmId`, `sourceSystem`, `sourceRecordId`, `householdId`, `clientId`, `title`, `content`, `summaryFlags.hasRestrictedPii`, `summaryFlags.redactedFields`, `creatorExternalId`, `creatorName`, `visibleTo`, `tagLabels`, `sourceCreatedAt`, `sourceUpdatedAt`, `sourceLastSyncedAt`, `status`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- `crm_task` -> `crm_tasks`, `canonical.crm_task.read`: `id`, `tenantId`, `enterpriseId`, `firmId`, `sourceSystem`, `sourceRecordId`, `householdId`, `clientId`, `name`, `description`, `summaryFlags.hasRestrictedPii`, `summaryFlags.redactedFields`, `dueDate`, `completed`, `assigneeExternalId`, `assigneeName`, `categoryLabel`, `tagLabels`, `sourceCreatedAt`, `sourceUpdatedAt`, `sourceLastSyncedAt`, `status`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

## Review failures

Demo remains unavailable when canonical Demo usage is undeclared, uses an
unsupported/custom field, uses unresolved computed property access, fails to
pin a supported scenario and catalog version, or is absent from the committed
artifact. These are Demo-only findings. Keep authenticated data access and
first-launch consent governed by the existing permission and sharing contracts.
