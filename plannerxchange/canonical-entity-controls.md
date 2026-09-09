# Canonical Entity Controls

Use this contract whenever an app field represents a PlannerXchange household, client, or account.

## Agent responsibility before implementation

Handle the empty-firm path whenever the workflow requires a canonical record,
even when the builder only asked for the business feature. Include it in your
plan, implement it, and verify it before calling the workflow complete.

The expected path is: open app -> no accessible clients -> Add client -> enter
client details and choose an accessible household or confirm an editable
suggested household name in the same form -> explicit save -> refresh the PX
list -> select the returned client ID -> continue the original workflow.
Cancellation keeps the current app state and creates nothing before submission.

Do not solve a missing Add flow by deleting the selector, creating fake records,
renaming a real client to avoid the contract, or telling the user to leave for
Core Data. If authority or a platform capability prevents the flow, preserve
work, explain the actual access/capability issue, and report the unmet acceptance
check. Do not bypass it. A legitimate read-only analysis app does not need every
CRUD operation; do not add unused write scopes or declarations.

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
- For clients, use `canonical.client.summary.read` for a human-readable name list.
  Fetch email, phone, address, date of birth, or other protected details only
  after selection through `canonical.client.sensitive.read`.
- Put `clientUserId`, `householdId`, `accountId`, or `sourceRefs` at the top level of related app-data records.

## Installation and launch ownership

PlannerXchange obtains firm-administrator approval for the app's reviewed
permissions during marketplace installation. Approved canonical categories
start with `all_accessible`, which includes current records, future records,
and records created by the app. A firm administrator may later narrow that
access in PlannerXchange App restrictions.

Builder apps must not implement a first-launch permission or record-selection
screen and must not wait for the shell to select a working client. On ordinary
launch, call the approved canonical APIs, render human-facing selectors from
their results, keep the returned stable IDs as identity, and refetch after
canonical mutations so the user sees current shared data.

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

Do not call `POST /workspace/core-data/records` from installed apps. It is the
first-party Core Data form endpoint, not a new builder write contract. Use the
documented household/client routes with matching write scopes and declarations.
The shell's reusable form does not by itself add a `ShellRuntimeContext`
callback; do not invent one.

Show `Add new` only when the app requests the matching write permission and declares `write` for that category. The action changes shared firm-wide PX data that other apps may read.

New households default to their creator when PX receives no trusted assignment.
Installed apps cannot submit assignment fields, and existing record-share
restrictions still apply.

Client creation requires a canonical household first. Choosing an existing
household requires `canonical.household.read` and a matching households read
declaration; creating one also requires `canonical.household.write` and a
households write declaration. The example below covers selection and creation
of both clients and their parent households. `chooseOrCreateHousehold()` is app pseudocode, not a
provided runtime helper.

### Empty selectors and in-app recovery

- Keep an authorized `Add client`, `Add household`, or `Add account` action in
  both empty and populated selectors. Do not send the user to Core Data as the
  only way to create a record needed by the app.
- Both custom forms and the optional standard `openCanonicalRecordForm` hook
  require user authority and reviewed app permissions/declarations. The hook is
  implemented locally but not yet released; feature-detect deployed support.
  It supports create for households/clients only. Accounts and standard edit/
  soft-delete are outside its first release. Do not invent unavailable methods,
  call private `/workspace` routes, or use the import launcher as a create result.
- For a new client, let the user choose an accessible household or confirm a
  suggested household within the same form. Do not silently create parents on
  page load, and do not submit unsupported advisor-assignment fields.
- After confirmed creation, retain the returned canonical ID, refresh approved
  reads, and select the new record without losing the app's current work.
- Preserve a successfully created household reference if client creation fails;
  retry only the missing step. An authorization error must remain visible and
  must not trigger repeated creation or a request to private shell endpoints.
- Distinguish no accessible records from failed requests, permission restrictions,
  no search matches, and incomplete pagination. Missing write permission needs
  an accurate access-resolution message, not a claim that no records exist.

Client and household read/write declarations (request only operations the app
actually implements; adding permissions requires review and installation approval):

```json
{
  "permissions": [
    "canonical.client.summary.read",
    "canonical.client.write",
    "canonical.household.read",
    "canonical.household.write"
  ],
  "canonicalDataAccessDeclarations": [
    {
      "id": "workflow-client",
      "category": "clients",
      "required": true,
      "purpose": "Select an existing client or create the client used by this workflow.",
      "scopes": ["read", "write"],
      "selectionEntity": "client"
    },
    {
      "id": "workflow-household",
      "category": "households",
      "required": true,
      "purpose": "Choose or create the household for the new client in the same form.",
      "scopes": ["read", "write"],
      "selectionEntity": "household"
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

## Acceptance evidence

Verify an empty firm, an existing accessible household, a populated selector,
no search matches, additional result pages, denied reads/writes, cancellation,
and a failed or uncertain save. A timed-out create may have succeeded: do not
blindly retry a non-idempotent POST. Preserve confirmed parent IDs when only
client creation fails. After save, prove the new record is accessible and
selected without losing the original work. Keep Public Demo synthetic.

Read and trace the actual API response contract; do not convert a 403, timeout,
or partial page into an empty firm. A successful read alone does not prove
that the creation flow is usable for an ordinary advisor. Rebuild the committed
artifact and retain the corresponding source/provenance evidence.

## Review findings

### `canonical-empty-state-dead-end`

AI review recommends a source fix when reachable production code and its mapped
artifact prove that a required PX selector stops at empty results and offers
only a trip to Core Data or an inert message. Trace the empty branch, Add action,
permissions, parent handling, save result, and continuation together. Correct
the workflow using this contract; changing only the message or rebuilding the
same code is insufficient. This semantic finding is nonblocking feedback.
Existing required authorization, canonical-contract, and security findings keep
their enforcement. Missing evidence, an honest access restriction, an optional
view, a synthetic Demo, or an optional bulk-import link alone is not this finding.


### `canonical-data-declaration-usage-missing`

The manifest declares a canonical category and operation, but reviewed source does not use a matching authorized PX call.

- Integrate through the documented SDK/gateway method or route for that category and operation, or
- remove the unused declaration and permission.

This finding blocks publication, activation, installation, and launch of the
candidate version because the app declared canonical-data intent that it does
not correctly implement. The last previously approved version may remain active.

### `canonical-entity-control-not-integrated`

The UI appears to represent a household, client, or account, but review cannot see PX-backed selection or governed creation.

- If it is canonical, implement the selector/create flow above and retain the PX ID.
- If it is app-local, rename the label and model so it does not imply a PX entity.

This is a required finding when review proves that a rendered
canonical-looking control is free text, generates or stores an app-local
identity, and has no matching PX read. It blocks publication of the candidate
version. An ambiguous control remains platform-owned review uncertainty rather
than a guessed builder finding.

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

### Standard form call and continuation

The current local shim includes the optional hook below. This does not guarantee
that the connected PX host has deployed it. Keep existing authorized custom forms
as an allowed fallback; never create a fake successful canonical ID.

```ts
if (!context.openCanonicalRecordForm) {
  // Show an in-app capability explanation or your authorized custom form.
  return;
}
const outcome = await context.openCanonicalRecordForm({ operation: "create", entity: "client" });
if (outcome.status === "completed" && outcome.record.kind === "client") {
  const { clientId, householdId } = outcome.record;
  // Keep these IDs even if a subsequent refresh fails. Refetch through your
  // existing approved client loader, select clientId, and resume the app task.
}
// cancelled: keep existing work. unavailable: explain its reason in context.
```

For statically reviewable form evidence, call the runtime method directly with a
literal request, e.g. `context.openCanonicalRecordForm({ operation: "create",
entity: "client" })`, after feature detection. Never pass form inputs, firm/app
identity or callback URLs. A new-client form suggests a household; only the user
can confirm it. Opening the form does not replace the app's own approved reads.
The PX form owns duplicate-submit and uncertain-save handling. A saved-record
refresh failure must never automatically open another create operation.

PX also owns recovery after an app closes during an uncertain save. It retains
only an opaque reference in shell-owned storage and checks it on the next Add
action. A user can cancel an uncommitted submission; if it already saved, PX
returns its authorized IDs instead. This never deletes canonical records. Do not
add builder browser storage, retry the create automatically, or turn a failed
selector refresh into a new save. If access to a completed record has been removed,
PX acknowledges that outcome without returning inaccessible IDs.
