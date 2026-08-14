# Canonical Entity Controls

Use this contract whenever an app field represents a PlannerXchange household, client, or account.

## Decide what the field means

Before writing UI code, choose one path:

1. **PX canonical entity:** the user selects an existing PX record or creates a new shared record through PX.
2. **App-local concept:** the value belongs only to this app. Give it a distinct label such as `Scenario participant`; do not call it `Client`, request canonical permissions, or imply that it updates Core Data.

A freeform `Client` or `Client email` field is not a canonical integration.

## Existing-record selection

- Request the exact read permission and matching `canonicalDataAccessDeclarations` category.
- Load records through the PX SDK/gateway or documented installed-app route.
- Present a searchable selector with loading, empty, and error states.
- Store the returned canonical ID. Display text is not identity.
- For clients, use `canonical.client.summary.read` for selection. Fetch email, phone, address, date of birth, or other protected details only after selection through `canonical.client.sensitive.read`.
- Put `clientUserId`, `householdId`, `accountId`, or `sourceRefs` at the top level of related app-data records.

Client read declaration:

```json
{
  "permissions": ["canonical.client.summary.read"],
  "canonicalDataAccessDeclarations": [
    {
      "id": "workflow-client",
      "category": "clients",
      "required": true,
      "purpose": "Select the client whose workflow is being prepared.",
      "scopes": ["read"],
      "selectionEntity": "client"
    }
  ]
}
```

```ts
const clients = await gateway.getClients({ search: query });
const selectedClientId = clients[0]?.id;
```

## Add new

Show `Add new` only when the app requests the matching write permission and declares `write` for that category. The action changes shared firm-wide PX data that other apps may read.

Client creation requires a canonical household first:

```json
{
  "permissions": [
    "canonical.client.summary.read",
    "canonical.client.write"
  ],
  "canonicalDataAccessDeclarations": [
    {
      "id": "workflow-client",
      "category": "clients",
      "required": true,
      "purpose": "Select an existing client or create the client used by this workflow.",
      "scopes": ["read", "write"],
      "selectionEntity": "client"
    }
  ]
}
```

```ts
const household = await chooseOrCreateHousehold();
const created = await gateway.createClient(household.id, {
  firstName,
  lastName,
  emailPrimary: email || undefined
});
setSelectedClientId(created.id);
```

Do not create canonical entities through `/app-data`, localStorage, browser databases, or a builder-owned backend.

## Public Demo

Public Demo must branch before any canonical or app-data call. Use synthetic in-memory households, clients, and accounts; do not ask for real identity, contact information, credentials, account identifiers, or files.

## Review findings

### `canonical-data-declaration-usage-missing`

The manifest declares a canonical category and operation, but reviewed source does not use a matching authorized PX call.

- Integrate through the documented SDK/gateway method or route for that category and operation, or
- remove the unused declaration and permission.

This finding is required only for the data-persistence goal. It does not block Draft, marketplace, or private-label publication by itself.

### `canonical-entity-control-not-integrated`

The UI appears to represent a household, client, or account, but review cannot see PX-backed selection or governed creation.

- If it is canonical, implement the selector/create flow above and retain the PX ID.
- If it is app-local, rename the label and model so it does not imply a PX entity.

This is a required Data-capability finding when review proves that a rendered
canonical-looking control is free text, generates or stores an app-local
identity, and has no matching PX read. It does not by itself block unrelated
Draft or marketplace outcomes. An ambiguous control remains platform-owned
review uncertainty rather than a guessed builder finding.

### `canonical-data-integration-incomplete`

The app claims a canonical category through an actual PX read, portable-data
intent plus a category working surface, or a PX import plus a working surface
for the same category. Complete all three layers independently:

1. Request the exact `canonical.*.read` permission.
2. Add the matching `canonicalDataAccessDeclarations` category and `read` scope.
3. Perform a reachable PX SDK/gateway or `authenticatedFetch` read and retain
   returned canonical IDs.

An import launcher alone is valid for an import-only utility. When the app also
shows a transaction, client, account, position, cost-basis, security, model, or
sleeve workspace, the import declaration does not replace the read contract.

### `canonical-data-build-artifact-missing`

The source read is valid but is absent from the committed artifact reachable
from `plannerxchange.publish.json`. Rebuild and commit `distRoot` plus
`plannerxchange.build-provenance.json`; an unrelated chunk cannot satisfy the
finding.

### `canonical-data-shadow-storage`

The app stores a second copy of a claimed canonical category in app-data. Read
the canonical record through PX and keep only builder-owned overlays, such as
categories, confirmations, annotations, or preferences, linked to the canonical
ID through top-level associations or `sourceRefs`.
