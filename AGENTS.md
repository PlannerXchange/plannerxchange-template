# PlannerXchange Builder Agent Context Guide

This repository is the public PlannerXchange AI-agent governance context pack.
Use it to understand the shell runtime, manifest, data, security, and review
rules for apps that builders create in their own repositories.

If these files have been copied into the root of a builder-owned app repo, treat
that local repo as the working app. If you are reading
`PlannerXchange/plannerxchange-template` by URL, do not edit this context repo;
make app changes only in the builder-owned app repository.

## Task routing

Use `plannerxchange/ai-index.md` to find the relevant topic. Read `README.md` for setup and `plannerxchange/context.md` for runtime integration. Read `plannerxchange/publish-notes.md` for publication or review remediation, `plannerxchange/data-contract.md` for import behavior, `plannerxchange/demo-mode.md` for public demos, and `plannerxchange/landing-page.md` for landing pages.

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
  `plannerxchange/canonical-demo-data.md`, use the public
  `/canonical-demo/*` API through the dependency-free starter helper, and do
  not install a Demo package or use custom fields.
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
- For this workflow, follow `plannerxchange/data-contract.md`; it preserves the exact supported APIs and remediation boundaries.
- Before review, obtain the applicable workstation resource approval for `npm run build` and run it. Run `npm run preflight` only when the app repo defines that script; otherwise run `npm run check` when defined. If neither exists, use the successful production build as the available local validation. Do not invent a missing script or ask the builder to choose between nonexistent commands. Include generated `distRoot` output in an authorized review commit.
- For this workflow, follow `plannerxchange/publish-notes.md`; it preserves the exact supported APIs and remediation boundaries.
- If the builder asks for a public landing page, read `plannerxchange/landing-page.md`.
  Landing pages may use YouTube or Vimeo embeds, but sign in, sign up, install,
  checkout, review, follow, and demo CTAs must hand off to PlannerXchange-owned
  flows. Do not add app-owned auth, signup, password, checkout, lead-capture,
  protected PlannerXchange API, or token-handling behavior to a public landing page.
