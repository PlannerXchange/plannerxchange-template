# PlannerXchange Builder Agent Context Guide

This repository is the public PlannerXchange AI-agent governance context pack.
Use it to understand the shell runtime, manifest, data, security, and review
rules for apps that builders create in their own repositories.

If these files have been copied into the root of a builder-owned app repo, treat
that local repo as the working app. If you are reading
`PlannerXchange/plannerxchange-template` by URL, do not edit this context repo;
make app changes only in the builder-owned app repository.

Before changing app code, read:

1. `README.md`
2. `plannerxchange/ai-index.md`
3. `plannerxchange/context.md`
4. `plannerxchange/publish-notes.md`
5. the specific `plannerxchange/*.md` file named by the index for the task

Core rules:

- If you create or follow a plan/spec/checklist and execution changes materially, update that artifact before finishing. Record what actually happened, why the path changed, current status, and any verification or blocker evidence. If you cannot safely update it, name the exact path as a follow-up.
- Use the exact `plannerxchange.app.json` schema already in this repo.
- Do not invent manifest fields from review labels. Do not add `capabilities`, `marketplace`, `portableData`, `demoMode`, `demoModeEnabled`, `supportsDemoMode`, `landingPage`, `landing_page`, `publicLandingPage`, `landingPageEnabled`, or `supportsLandingPage`.
- Use `visibility: "marketplace_listed"` for marketplace intent.
- Use `dataPortabilityMode: "plannerxchange_portable"` for portable-data intent.
- Use exact scope strings in `permissions` for PlannerXchange API access.
- Before adding a field named Client, Household, or Account, read `plannerxchange/canonical-entity-controls.md`. Canonical entities use PX-backed search/selection, stable PX IDs, and governed creation; app-local freeform concepts must use distinct labels and models.
- Demo mode is enabled from Creator Studio after review eligibility; it is not currently a builder manifest field.
- Canonical-data Demo apps use `canonicalDataUsageDeclarations` only for exact
  field-level review evidence. This does not enable Demo mode or replace
  permissions and `canonicalDataAccessDeclarations`; follow
  `plannerxchange/canonical-demo-data.md` and do not use custom fields.
- Public landing pages are enabled from PlannerXchange after review eligibility; they are not currently builder manifest fields.
- PlannerXchange owns auth, routing, shell context, disclosure, publication review, and app installation identity.
- Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls.
- Treat `/app-data` as a statically reviewable record API. Keep methods and
  request bodies literal or statically typed, retain server-issued record IDs,
  and read/write `payload`. A `dynamic_request_contract` review result is an app
  finding; `request_shape_resolution_unavailable` is a PlannerXchange processing
  failure and does not justify a speculative app rewrite.
- Do not call app-owned backend routes such as `/api/questions`, `/api/results`, `/questions`, or `/results`; shell-published apps are static frontend plugins.
- Do not use `VITE_API_URL`, `VITE_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, or similar frontend env vars for shell-published runtime behavior.
- Do not add runtime Python scripts, Flask/FastAPI apps, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, or subprocess expectations for shell-published behavior. Python is local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path.
- Do not use frontend external-provider keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, or `NEXT_PUBLIC_*_API_KEY`; browser-published apps must not ship Tavily/OpenAI/Anthropic/Gemini keys.
- Keep mock data obviously synthetic and use `@example.test` emails.
- When `demo_mode` is selected, read `plannerxchange/demo-mode.md`; branch on public demo context before authenticated initialization, preload synthetic data, skip identity/file intake, and perform no protected fetch or persistence.
- Do not add app-owned login, direct database clients, service-role keys, direct provider API access, direct `/imports/*` calls, or external AI/search/provider egress for PlannerXchange client data. `egressDeclarations` are review evidence, not approval; non-enterprise Day 1 self-serve egress is blocked.
- For high-risk CSV import sessions, `ctx.openDataImportSession({ declarationId, mode: "canonical_store" })` is a launch-only handoff and returns `{ mode: "canonical_store", status: "launched" }`. Do not wait for `completed`, `completed_with_errors`, `cancelled`, `importJobId`, `canonicalRefs`, or `mappingSummary`; after the user returns to the app, refresh approved canonical read APIs.
- Do not invent a Creator Studio column-mapping-template prerequisite for `px_import_session`. The PlannerXchange import wizard owns upload, suggested field mapping, skipped fields, user confirmation, validation, audit, and canonical import.
- Do not tell builders to split a valid account CSV only because it contains multiple custodians. PX import sessions support mixed-custodian account files when a custodian column is mapped or the advisor supplies per-account custodians during review.
- If the PX import wizard URL opens but the wizard screen is blank, do not tell
  the builder to configure a mapping template or redesign app CSV code. Treat it
  as a PlannerXchange shell/runtime issue or stale deployed shell, capture the
  URL and console logs, refresh the current PX CLI/context, and report the PX
  platform issue.
- If the PX import wizard says the current workspace plan does not support CSV
  import or hosted data storage, do not tell an installed app user to upgrade.
  Treat it as a publisher/workspace-admin configuration issue and direct the
  builder to the Creator Studio publish checklist, workspace billing, or a
  platform admin for dev-tier enablement.
- If Creator Studio says a paid platform capability is not available on the
  builder workspace's plan, do not redesign correct `px_import_session` app
  code unless the builder chooses to remove the capability. The builder must
  either upgrade the builder workspace or remove the paid feature before
  publication.
- Any import-specific route, navigation item, page, or primary action must call
  `ctx.openDataImportSession` with the matching stable declaration ID. Launch
  immediately on navigation or from the page's primary action. App UI may show
  only a transient launching state or a recoverable error; an informational-only
  import page is a blocking contract violation.
- A local wrapper is supported when review can statically trace relative imports,
  configured local `tsconfig`/`jsconfig` path aliases, parameter forwarding,
  assignments, and aliases from that user action to the matching runtime helper
  and declaration ID. Prefer a direct call when a wrapper adds no application
  value. Ambiguous or unresolved local aliases cannot prove integration.
- Before review, run `npm run build`. Run `npm run preflight` only when the app repo defines that script; otherwise run `npm run check` when defined. If neither exists, use the successful production build as the available local validation. Do not invent a missing script or ask the builder to choose between nonexistent commands. Commit the generated `distRoot` output.
- Before using PX CLI review feedback, update the CLI with `px --update dev`
  for the dev shell or `px --update` for production. If that command is not
  recognized, use the install block copied from Creator Studio.
- After pushing to GitHub, use the PlannerXchange CLI when available:
  `px feedback --env dev --goal <selected-goal> --commit HEAD --format markdown`.
  Treat `px feedback` as the canonical builder-agent feedback loop command. The
  `--goal` value only filters findings from the latest full review; it does not
  start a review, rerun a goal-specific review, or select individual review
  steps. The CLI is read-only.
- If the builder already stated what they want the app to do, map that outcome
  to the internal goal without asking again. Otherwise ask with plain choices:
  try it privately; list it for other advisors; let anyone try a sample using
  made-up information; show a public information page; match each firm's
  branding; use PlannerXchange information; or check every app outcome. Do not
  show internal goal IDs or platform implementation jargon unless the builder
  asks. Internally map the answer to `draft`, `marketplace`, `demo_mode`,
  `landing_page`, `private_label`, `data_persistence`, or `all`.
- A pushed commit queues the full review pipeline. Creator Studio's `Run fresh
  review` action can queue the full pipeline for the current commit. PX CLI
  cannot queue review work.
- Human-facing retry feedback says that PlannerXchange is retrying
  automatically and that no action is needed. Internal attempt counts may
  appear only in machine-readable JSON for agents or support; they are not a
  limit on builder code changes, commits, or future full-review requests.
- If PlannerXchange cannot verify only Demo mode after its automatic retries,
  Demo stays off and the rest of the review completes. Do not change app code
  unless the review also returns a direct Demo violation or another required
  finding. Do not treat Demo verification uncertainty as an app-wide blocker.
- Fix only the current required fix group returned for the selected goal,
  then rebuild, commit, push, and run the watch command again.
- Before telling the builder that a PlannerXchange API, SDK helper, runtime
  context field, manifest contract, or review remediation path is unavailable,
  refresh this public context pack and the local `@plannerxchange/sdk` or
  `src/plannerxchange.ts` shim, then verify against the latest review export.
- If the builder asks for a public landing page, read `plannerxchange/landing-page.md`.
  Landing pages may use YouTube or Vimeo embeds, but sign in, sign up, install,
  checkout, review, follow, and demo CTAs must hand off to PlannerXchange-owned
  flows. Do not add app-owned auth, signup, password, checkout, lead-capture,
  protected PlannerXchange API, or token-handling behavior to a public landing page.
