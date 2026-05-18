# PlannerXchange AI Builder Index

Use this file as the lookup table for AI-assisted builds.

Do not guess PlannerXchange schema or API names from review labels. Find the matching contract below, then edit the app code or `plannerxchange.app.json` using the documented field and route names.

## Start Here

Read these first:

1. `README.md` - starter workflow, local development, and AI prompt
2. `plannerxchange/context.md` - shell/runtime boundaries and core platform rules
3. `plannerxchange/publish-notes.md` - manifest, review, build, and publication rules
4. `plannerxchange/api-reference.md` - live route paths and permission scopes

Then read only the file needed for the current task.

## Common Tasks

| Task | Read | Edit |
| --- | --- | --- |
| Fix manifest or review metadata | `plannerxchange/publish-notes.md`, this file | `plannerxchange.app.json` |
| Add or change API access | `plannerxchange/api-reference.md`, `plannerxchange/data-contract.md` | `plannerxchange.app.json`, app API calls |
| Save app-owned work product | `plannerxchange/app-data-api.md` | `src/lib/px-gateway.ts`, app data models |
| Read clients, households, accounts, positions, transactions, CRM, or tax data | `plannerxchange/api-reference.md`, `plannerxchange/data-contract.md`, `plannerxchange/pii-and-security.md` | `plannerxchange.app.json`, app API calls |
| Add white-label branding or disclosures | `plannerxchange/branding-and-legal-api.md` | UI components, `plannerxchange.app.json` scopes |
| Check access grants or feature entitlements | `plannerxchange/app-access.md` | runtime access checks |
| Send workflow email | `plannerxchange/email-api.md` | `plannerxchange.app.json`, email call site |
| Handle CSV or file uploads | `plannerxchange/app-data-api.md`, `plannerxchange/data-contract.md`, `plannerxchange/pii-and-security.md` | `plannerxchange.app.json`, upload flow |
| Fix auth/session review findings | `plannerxchange/context.md`, `plannerxchange/api-reference.md` | remove app-owned auth code |
| Fix build or publish artifact findings | `plannerxchange/publish-notes.md`, `vite.config.ts`, `scripts/preflight.mjs` | build config, committed `distRoot` |
| Decide mock vs live behavior | `plannerxchange/context.md`, `src/plannerxchange.ts`, `src/dev-context.ts` | runtime branching |

## Manifest Schema

Use these `plannerxchange.app.json` fields:

```json
{
  "slug": "sample-advisor-tool",
  "name": "Sample Advisor Tool",
  "version": "0.1.0",
  "summary": "Short marketplace/review summary.",
  "description": "Longer app description.",
  "priceLabel": "Included",
  "framework": "react",
  "appRoot": ".",
  "distRoot": "dist",
  "workspacePackage": null,
  "entryPoint": "src/plugin.tsx",
  "permissions": ["tenant.read", "user.read"],
  "configSchemaVersion": 1,
  "visibility": "private",
  "dataPortabilityMode": "app_managed_nonportable",
  "egressDeclarations": [],
  "dataIngressDeclarations": [],
  "categories": ["cash-flow"]
}
```

Do not add these unsupported fields:

- `capabilities`
- `marketplace`
- `marketplaceDistribution`
- `portableData`
- `demoMode`
- `demoModeEnabled`
- `supportsDemoMode`

## Review Labels To Manifest Fields

| Review or UI phrase | What it means | Correct action |
| --- | --- | --- |
| Marketplace distribution | PlannerXchange detected or evaluated public listing intent | Use `visibility: "marketplace_listed"` only if the app should be marketplace-listed |
| Portable data | App declares or uses PlannerXchange portable/canonical data behavior | Use `dataPortabilityMode: "plannerxchange_portable"` and approved PX APIs |
| Data approved | Eligibility outcome after review, not a manifest field | Fix data findings; request exact scopes in `permissions` |
| Demo mode | Optional Creator Studio mode using synthetic data | Do not edit the manifest; enable demo mode in Creator Studio when eligible |
| Private-label ready | Eligibility outcome for branding/legal behavior | Request `branding.read` or `legal.read` only when the UI consumes those contexts |
| App-data write | App stores builder-owned work product through PX | Add `app_data.write` and use the app-data contract |
| CSV/file ingress | App parses or uploads files | Add `dataIngressDeclarations`; use an approved target lane |
| External egress | App references non-PX hosts | Add `egressDeclarations`; high-risk client-data egress may still be blocked |

## Permission Lookup

Common low-risk scopes:

- `tenant.read`
- `user.read`
- `app_access.read`
- `feature_entitlements.read`
- `branding.read`
- `legal.read`

App-owned work product:

- `app_data.read`
- `app_data.write`

Canonical data reads:

- `canonical.household.read`
- `canonical.client.summary.read`
- `canonical.client.sensitive.read`
- `canonical.account.read`
- `canonical.position.read`
- `canonical.transaction.read`
- `canonical.cost_basis.read`
- `canonical.security.read`
- `canonical.model.read`
- `canonical.sleeve.read`
- `canonical.crm_note.read`
- `canonical.crm_task.read`

Email:

- `email.send`

Request only the scopes the app actually uses.

## Runtime Rules

- The shell injects `ShellRuntimeContext`.
- Use `ctx.authenticatedFetch` for protected PlannerXchange API calls.
- Use `ctx.apiBaseUrl`; do not hardcode PlannerXchange API URLs.
- Use `ctx.appBasename`, `ctx.initialPath`, and `ctx.navigate` for app routing.
- Use `isShellHosted(ctx)` to distinguish real shell runtime from local mock mode.
- Do not use build-time env vars such as `VITE_PX_MODE` to choose live behavior in the published artifact.
- Do not manually attach bearer tokens.
- Do not pass `appInstallationId` in query strings.

## Persistence Rules

Use PlannerXchange app-data for builder-owned work product such as:

- scenarios
- questionnaires
- recommendations
- projections
- report drafts
- app-authored notes

For client-, household-, or account-linked app-data records, include a top-level `clientUserId`, `householdId`, `accountId`, or `sourceRefs`. A `clientId` hidden inside `payload` is not enough for governance, filtering, export, lifecycle, or support.

Do not add builder-owned database clients, ORM clients, service-role keys, database URL env vars, or direct integration-provider API clients for PlannerXchange client/subscriber data.

## CSV And File Ingress

If the app accepts CSVs, spreadsheets, drag/drop files, browser `FileReader`, `FormData`, or file uploads:

1. Add `dataIngressDeclarations`.
2. Choose an approved target lane.
3. Do not call `/imports/*` or `/integrations/*` directly.
4. Do not auto-create canonical households, clients, accounts, positions, transactions, cost basis, restricted PII, or import jobs from app-managed CSV logic.

Approved target lanes:

- `px_core_import_handoff`
- `px_app_data_upload`
- `browser_ephemeral_app_data`
- `enterprise_external_exception`

## Build And Preflight

Before publication:

1. Run `npm run build`.
2. Confirm `<distRoot>/plannerxchange.publish.json` exists.
3. Confirm `<distRoot>/plannerxchange.build-provenance.json` exists.
4. Run `npm run preflight`.
5. Commit source, lockfiles, manifest, and generated `distRoot` output from the same code version.

Do not hand-edit generated publish or build-provenance files.

## When In Doubt

- Prefer the existing template shape over new schema.
- Search this `plannerxchange/` folder before inventing routes, fields, or scopes.
- If review feedback names a capability, map it through this file before editing `plannerxchange.app.json`.
- If the app needs a capability not documented here, leave a TODO and ask PlannerXchange support instead of guessing.
