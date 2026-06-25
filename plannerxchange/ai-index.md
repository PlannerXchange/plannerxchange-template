# PlannerXchange AI Builder Index

Use this file as the lookup table for AI-assisted builds.

Do not guess PlannerXchange schema or API names from review labels. Find the matching contract below, then edit the app code or `plannerxchange.app.json` using the documented field and route names.

## Start Here

Read these first:

1. `README.md` - context-pack workflow, local development, PX CLI review loop, and AI prompt
2. `plannerxchange/context.md` - shell/runtime boundaries and core platform rules
3. `plannerxchange/publish-notes.md` - manifest, review, build, and publication rules
4. `plannerxchange/api-reference.md` - live route paths and permission scopes

Then read only the file needed for the current task.

Before declaring that a PlannerXchange API, SDK helper, runtime context field,
manifest contract, or review remediation path is unavailable, refresh this
public context pack and the local `@plannerxchange/sdk` or
`src/plannerxchange.ts` shim, then verify against the latest PlannerXchange
review export. Do not describe a capability as future-state or missing when
the current context pack, SDK, or review export documents it as available.

## Common Tasks

| Task | Read | Edit |
| --- | --- | --- |
| Fix manifest or review metadata | `plannerxchange/publish-notes.md`, this file | `plannerxchange.app.json` |
| Add or change API access | `plannerxchange/api-reference.md`, `plannerxchange/data-contract.md` | `plannerxchange.app.json`, app API calls |
| Save app-owned work product | `plannerxchange/app-data-api.md` | `src/lib/px-gateway.ts`, app data models |
| Read clients, households, accounts, positions, transactions, CRM, or tax data | `plannerxchange/api-reference.md`, `plannerxchange/data-contract.md`, `plannerxchange/pii-and-security.md` | `plannerxchange.app.json`, app API calls |
| Create, update, or soft-delete PX canonical records | `plannerxchange/api-reference.md`, `plannerxchange/data-contract.md`, `plannerxchange/pii-and-security.md` | `plannerxchange.app.json`, `src/lib/px-gateway.ts`, app API calls |
| Add white-label branding or disclosures | `plannerxchange/branding-and-legal-api.md` | UI components, `plannerxchange.app.json` scopes |
| Check access grants or feature entitlements | `plannerxchange/app-access.md` | runtime access checks |
| Send workflow email | `plannerxchange/email-api.md` | `plannerxchange.app.json`, email call site |
| Handle CSV or file uploads | `plannerxchange/app-data-api.md`, `plannerxchange/data-contract.md`, `plannerxchange/pii-and-security.md` | `plannerxchange.app.json`, upload flow |
| Fix auth/session review findings | `plannerxchange/context.md`, `plannerxchange/api-reference.md` | remove app-owned auth code |
| App needs Python, backend scripts, server-side functions, containers, or jobs | `plannerxchange/context.md`, `plannerxchange/publish-notes.md`, this file | do not implement runtime Python for shell publication; ask PlannerXchange which governed product lane applies |
| Add or fix public landing-page behavior | `plannerxchange/landing-page.md`, `plannerxchange/publish-notes.md`, this file | landing-page source/components, CTA definitions, public-safe media |
| Fix build or publish artifact findings | `plannerxchange/publish-notes.md`, `vite.config.ts`, `scripts/preflight.mjs` | build config, committed `distRoot` |
| Update PX CLI | `README.md` | run `px --update dev` for dev or `px --update` for production; if not recognized, use the Creator Studio install block once |
| Fetch PlannerXchange review feedback | `README.md`, `plannerxchange/publish-notes.md` | ask the builder for the current goal, then run `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown` |
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
- `landingPage`
- `landing_page`
- `publicLandingPage`
- `landingPageEnabled`
- `supportsLandingPage`

## Review Labels To Manifest Fields

| Review or UI phrase | What it means | Correct action |
| --- | --- | --- |
| Marketplace distribution | PlannerXchange detected or evaluated public listing intent | Use `visibility: "marketplace_listed"` only if the app should be marketplace-listed |
| Portable data | App declares or uses PlannerXchange portable/canonical data behavior | Use `dataPortabilityMode: "plannerxchange_portable"` and approved PX APIs |
| Data approved | Eligibility outcome after review, not a manifest field | Fix data findings; request exact scopes in `permissions` |
| Demo mode | Optional Creator Studio mode using synthetic data | Do not edit the manifest; enable demo mode in Creator Studio when eligible |
| Landing page | Optional public marketplace nicety with public-safe copy, approved media, and PX-owned CTA handoffs | Read `landing-page.md`; do not edit the manifest unless another documented field also needs changes |
| Private-label ready | Eligibility outcome for branding/legal behavior | Request `branding.read` or `legal.read` only when the UI consumes those contexts |
| App-data write | App stores builder-owned work product through PX | Add `app_data.write` and use the app-data contract |
| Canonical write | App mutates shared PX shell data | Add the narrowest matching `canonical.*.write` scope and use governed canonical APIs |
| CSV/file ingress | App parses or uploads files | Add `dataIngressDeclarations`; use an approved target lane |
| External egress | App references non-PX hosts | Add `egressDeclarations`; high-risk client-data egress remains blocked unless PlannerXchange accepts an enterprise exception |

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
- `canonical.tax.summary.read`
- `canonical.tax.detail.read`
- `canonical.position.read`
- `canonical.transaction.read`
- `canonical.cost_basis.read`
- `canonical.security.read`
- `canonical.model.read`
- `canonical.sleeve.read`
- `canonical.crm_note.read`
- `canonical.crm_task.read`

Canonical data writes:

- `canonical.household.write`
- `canonical.client.write`
- `canonical.account.write`
- `canonical.tax.write`
- `canonical.integration_link.write`
- `canonical.security.firm_override`
- `canonical.asset_class.write`
- `canonical.custom_field.write`
- `canonical.import.write`

Write scopes allow create, update, and soft-delete for the approved route family only. `DELETE` means soft-delete. Hard-delete, purge, provider OAuth secrets, and platform cleanup are not builder-facing capabilities.

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
- Do not call app-owned backend routes such as `/api/questions`, `/api/results`, `/questions`, or `/results`; shell-published apps are static frontend plugins.
- Do not use `VITE_API_URL`, `VITE_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, or similar frontend env vars for shell-published runtime behavior.
- Do not add runtime Python scripts, Flask/FastAPI apps, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, or subprocess calls for shell-published behavior. Python can be local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path.
- Do not use browser-exposed provider keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, or `NEXT_PUBLIC_*_API_KEY`, and do not call Tavily/OpenAI/Anthropic/Gemini directly with PX/client data.
- Treat `egressDeclarations` as review evidence, not approval. There is no non-enterprise Day 1 self-serve exception for external PX/client data egress.
- Do not manually attach bearer tokens.
- Do not pass `appInstallationId` in query strings.

## Public Landing Pages

Landing pages are optional review modes. They are not manifest fields.

Use `plannerxchange/landing-page.md` before building or fixing one.

Rules:

- Keep `/marketplace/apps/{slug}` as the canonical public app URL.
- Use only public-safe copy, fixtures, screenshots, and videos.
- YouTube and Vimeo iframe embeds are allowed for public demo or explainer videos.
- Sign in, sign up, install, checkout, review, follow, and demo CTAs must hand off to PlannerXchange-owned flows.
- Do not render app-owned auth, signup, password, invite, checkout, lead-capture, provider-connect, upload, protected API, or token-handling behavior on a public landing page.
- Use `px feedback --env dev --goal landing_page --commit HEAD --format markdown` only when landing-page readiness is the current goal.

## Persistence Rules

Use PlannerXchange app-data for builder-owned work product such as:

- scenarios
- questionnaires
- recommendations
- projections
- report drafts
- app-authored notes

For client-, household-, or account-linked app-data records, include a top-level `clientUserId`, `householdId`, `accountId`, or `sourceRefs`. A `clientId` hidden inside `payload` is not enough for governance, filtering, export, lifecycle, or support.

Use governed canonical write APIs only when the app needs to mutate shared PX shell data such as households, clients, accounts, tax filings, integration links, or approved reference/admin records. These mutations affect the firm-wide canonical record other apps may read later.

Do not add builder-owned database clients, ORM clients, service-role keys, database URL env vars, or direct integration-provider API clients for PlannerXchange client/subscriber data.

## CSV And File Ingress

If the app accepts CSVs, spreadsheets, drag/drop files, browser `FileReader`, `FormData`, or file uploads:

1. Add `dataIngressDeclarations`.
2. Choose an approved target lane.
3. Do not call provider OAuth `/integrations/*`, hard-delete/cleanup routes, or platform-only import routes directly.
4. For high-risk client/account/custodian CSVs, declare `target: "px_import_session"` and call `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })`.
5. Treat `openDataImportSession` as launch-only. The current result is `{ mode: "canonical_store", status: "launched" }`; do not wait for `completed`, `completed_with_errors`, `cancelled`, `importJobId`, `canonicalRefs`, or `mappingSummary`.
6. Do not parse, map, normalize, or auto-create canonical households, clients, accounts, positions, transactions, cost basis, restricted PII, or import jobs from app-managed CSV logic outside the governed PX import-session and canonical write contracts.
7. If the PX import wizard route opens but renders blank, do not invent a mapping-template setup step. Treat the blank wizard as a PX shell/runtime issue or stale deployed shell; capture the URL and console logs, refresh CLI/context, and report the platform issue.
8. If Creator Studio says canonical CSV import or hosted data storage is not allowed on the builder workspace's plan, treat it as a publish eligibility issue, not an app-code issue. The builder must upgrade the builder workspace or remove the paid capability before publication.
9. If the PX import wizard says CSV import or hosted data storage is not available in the current workspace, do not tell an installed app user to upgrade. Report it as a publisher/workspace-admin configuration issue and send the builder to the Creator Studio publish checklist, workspace billing, or a platform admin for dev-tier enablement.

PlannerXchange import-session support:

- `canonical_store` import handoff launches the PlannerXchange Core Data import wizard.
- The wizard handles upload, suggested field mapping to canonical PlannerXchange fields, skipped fields, user mapping confirmation, validation, audit, and canonical import.
- If `openDataImportSession` does not compile on `ShellRuntimeContext`, refresh `src/plannerxchange.ts` from this template before changing app code.
- Do not invent a Creator Studio mapping-template prerequisite for `px_import_session`; the PlannerXchange import wizard owns the mapping flow.
- After the user returns to the app, refresh imported canonical data through approved canonical read APIs.

Approved target lanes:

- `px_core_import_handoff`
- `px_import_session`
- `px_app_data_upload`
- `browser_ephemeral_app_data`
- `enterprise_external_exception`

Minimal high-risk CSV declaration:

```json
{
  "id": "custodian-trade-csv",
  "source": "csv_upload",
  "purpose": "Launch a PX-owned import session for custodian trade CSVs.",
  "dataClasses": ["transactions", "account_data"],
  "target": "px_import_session",
  "supportedModes": ["canonical_store"],
  "canonicalEntityHints": ["transaction", "account"],
  "sourceFormatHints": ["altruist", "schwab"],
  "canonicalMutation": true
}
```

## Build And Preflight

Before publication:

1. Run `npm run build`.
2. Confirm `<distRoot>/plannerxchange.publish.json` exists.
3. Confirm `<distRoot>/plannerxchange.build-provenance.json` exists.
4. Run `npm run preflight`.
5. Commit source, lockfiles, manifest, and generated `distRoot` output from the same code version.
6. Push to GitHub so PlannerXchange review can run for that commit.
7. Ask the builder which goal applies now, then run `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown`.
8. If required fixes return, fix only the current fix group, rebuild, commit, push, and watch again.

Do not hand-edit generated publish or build-provenance files.

## When In Doubt

- Prefer the existing template shape over new schema.
- Search this `plannerxchange/` folder before inventing routes, fields, or scopes.
- If review feedback names a capability, map it through this file before editing `plannerxchange.app.json`.
- If local types or copied context disagree with review feedback, refresh this context pack and the local SDK or `src/plannerxchange.ts` shim before changing app architecture.
- If the app needs a capability not documented here, leave a TODO and ask PlannerXchange support instead of guessing.
