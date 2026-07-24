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

## Review and enablement

PlannerXchange reviews the source revision and committed artifact for the demo branch, synthetic fixtures, absent protected access, absent identity intake, and absent persistence. Demo enablement is fail-closed and is bound to the reviewed source SHA and current review policy. A new commit, stale policy, missing committed artifact evidence, or required demo finding disables public demo availability until review passes again.

Use:

```sh
px feedback --env dev --goal demo_mode --commit HEAD --format markdown
```

The Markdown output includes a `Selected Goal Contract` section even when no required fixes remain. JSON output exposes the same rules under `goalScope.guidance`, so builder agents can verify the reviewed demo contract without inferring it from an empty findings list.

The `demo_mode` goal only filters Demo-related findings from the latest full review. It does not run a Demo-only review or start any pipeline step. A pushed commit queues the full review pipeline; Creator Studio's `Run fresh review` action can queue the full pipeline for the current unchanged commit. PX CLI cannot queue review work.

Fix the current required demo group, rebuild and commit `distRoot`, push, and wait for review before enabling demo mode in Creator Studio.

PlannerXchange decides Demo eligibility through programmatic and AI/agentic code review of the exact source and committed artifact. Private-browser execution and manual end-user testing are not approval gates. If review cannot distinguish missing demo behavior from an analyzer limitation, Demo mode remains unavailable while PlannerXchange resolves the verification issue; builders should not be directed through repeated generic code changes.
