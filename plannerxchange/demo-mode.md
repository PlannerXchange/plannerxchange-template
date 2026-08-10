# Public Demo Mode

Public demo mode is an optional Creator Studio capability for marketplace-listed apps. It is declared by selecting the `demo_mode` review goal or requesting enablement in Creator Studio. It is not a `plannerxchange.app.json` field.

## Runtime contract

Branch on runtime context before authenticated app initialization:

```ts
import { isPublicDemo } from "./plannerxchange";

export function mount(ctx: ShellRuntimeContext) {
  if (isPublicDemo(ctx)) {
    return mountDemo({
      demoDataMode: "synthetic",
      syntheticData: DEMO_SCENARIO
    });
  }

  return mountAuthenticatedApp(ctx);
}
```

The public context has `runtimeMode: "public_demo"`, `isDemoMode: true`, and `demoDataMode: "synthetic"`. It does not provide `authenticatedFetch`, protected session credentials, canonical data, app-data access, or import-session capabilities. Treat those functions as genuinely absent; do not construct replacements.

## Required behavior

- Enter the useful app experience with deterministic synthetic data already loaded.
- Skip onboarding that asks for an end-client name, email, phone, address, password, account identifier, or file.
- Keep optional, non-identifying visitor scenario changes in component memory only and discard them when the demo ends.
- Do not read or write `/app-data`, canonical APIs, provider integrations, browser storage, cookies, caches, analytics identifiers, or app-owned backends.
- Do not request sign-in or treat an empty token as an authenticated session.
- Keep all people, firms, accounts, and emails obviously synthetic; use `@example.test` where an email must appear in the scenario.

## Canonical-data apps

When the authenticated app reads PX canonical data, use the shared read-only
fixture adapter in the public branch so Demo behavior stays aligned with the
live SDK interface:

```ts
import { createPlannerXchangeDemoDataClient } from "@plannerxchange/demo-data";

const api = isPublicDemo(ctx)
  ? createPlannerXchangeDemoDataClient({
      scenario: "standard",
      catalogVersion: "px_canonical_demo_v1"
    })
  : createPlannerXchangeApiClient({ context: ctx, apiBaseUrl });
```

Use a literal `smoke`, `standard`, or `edge` scenario and the literal catalog
version shown above. In `plannerxchange.app.json`, add
`canonicalDataUsageDeclarations` for every canonical object and exact field
path used by the app, with one or more uses from `display`, `calculation`,
`filter`, `sort`, and `selection`. This field is review evidence only:
permissions still authorize API calls, and `canonicalDataAccessDeclarations`
still govern category/operation sharing and consent.

Custom fields are not supported in Day 1 Demo mode. Do not use computed
property access such as `transaction[fieldName]` for canonical records in a
Demo-capable path; review must be able to match literal accesses to the pinned
catalog. See `plannerxchange/canonical-demo-data.md` for the object and field
catalog.

For the best public Demo experience, give every functional or data-workflow
page reachable from Demo navigation enough deterministic synthetic content to
show its intended UX. A record, chart, table, card, or representative scenario
is sufficient. About, Help, Settings, and purely instructional pages do not
need artificial data.

## Review and enablement

PlannerXchange reviews the source revision and committed artifact for the demo branch, synthetic fixtures, absent protected access, absent identity intake, and absent persistence. Demo enablement is fail-closed and is bound to the reviewed source SHA and current review policy. A new commit, stale policy, missing committed artifact evidence, or required demo finding disables public demo availability until review passes again.

Use:

```sh
px feedback --env dev --goal demo_mode --commit HEAD --format markdown
```

The Markdown output includes a `Selected Goal Contract` section even when no required fixes remain. JSON output exposes the same rules under `goalScope.guidance`, so builder agents can verify the reviewed demo contract without inferring it from an empty findings list.

The `demo_mode` goal only filters Demo-related findings from the latest full review. It does not run a Demo-only review or start any pipeline step. A pushed commit queues the full review pipeline; Creator Studio's `Run fresh review` action can queue the full pipeline for the current unchanged commit. PX CLI cannot queue review work.

Fix the current required demo group, rebuild and commit `distRoot`, push, and wait for review before enabling demo mode in Creator Studio.

PlannerXchange decides Demo eligibility through programmatic and AI/agentic code review of the exact source and committed artifact. Private-browser execution and manual end-user testing are not approval gates.

If PlannerXchange cannot verify Demo mode after its automatic retries, the full review still completes and only Demo remains off. Other app options are unaffected. Human-facing feedback says that PlannerXchange could not verify Demo mode and does not request an app-code change. Do not direct the builder through repeated generic code changes or treat the app as blocked.

Direct, specific Demo findings are different. If the review proves that the public Demo path performs a protected request, accesses app data, saves information, requires identity entry, or lacks loaded synthetic data, fix that Demo-only finding before enabling Demo.

For canonical-data apps, also fix missing or invalid field declarations,
custom/computed field access, an unpinned scenario/catalog version, or a Demo
fixture adapter that is missing from committed build output. These findings
remain Demo-only and do not grant or revoke authenticated canonical access.

PlannerXchange may also return the recommended Demo-only suggestion
`demo-page-synthetic-coverage` when code-review evidence clearly shows a
functional page with no meaningful synthetic content. This suggestion does not
block Demo eligibility or another app goal. Add a small fixture-backed scenario
when it would help visitors understand the page; do not add data to About, Help,
Settings, or instructional-only pages merely to silence the suggestion.
