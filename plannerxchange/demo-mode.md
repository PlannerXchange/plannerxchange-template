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

Fix the current required demo group, rebuild and commit `distRoot`, push, and wait for review before enabling demo mode in Creator Studio.

The current artifact check verifies the committed runtime contract. PlannerXchange may add an isolated browser-execution smoke gate; builders should already exercise `/apps/{slug}/demo` as a signed-out visitor before requesting availability.
