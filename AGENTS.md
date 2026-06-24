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

- Use the exact `plannerxchange.app.json` schema already in this repo.
- Do not invent manifest fields from review labels. Do not add `capabilities`, `marketplace`, `portableData`, `demoMode`, `demoModeEnabled`, `supportsDemoMode`, `landingPage`, `landing_page`, `publicLandingPage`, `landingPageEnabled`, or `supportsLandingPage`.
- Use `visibility: "marketplace_listed"` for marketplace intent.
- Use `dataPortabilityMode: "plannerxchange_portable"` for portable-data intent.
- Use exact scope strings in `permissions` for PlannerXchange API access.
- Demo mode is enabled from Creator Studio after review eligibility; it is not currently a builder manifest field.
- Public landing pages are enabled from PlannerXchange after review eligibility; they are not currently builder manifest fields.
- PlannerXchange owns auth, routing, shell context, disclosure, publication review, and app installation identity.
- Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls.
- Do not call app-owned backend routes such as `/api/questions`, `/api/results`, `/questions`, or `/results`; shell-published apps are static frontend plugins.
- Do not use `VITE_API_URL`, `VITE_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, or similar frontend env vars for shell-published runtime behavior.
- Do not add runtime Python scripts, Flask/FastAPI apps, notebooks, Celery/RQ workers, serverless functions, Docker containers, scheduled jobs, or subprocess expectations for shell-published behavior. Python is local/build tooling only unless PlannerXchange explicitly approves a governed Python runtime or AI Connector path.
- Do not use frontend external-provider keys such as `VITE_TAVILY_API_KEY`, `VITE_OPENAI_API_KEY`, or `NEXT_PUBLIC_*_API_KEY`; browser-published apps must not ship Tavily/OpenAI/Anthropic/Gemini keys.
- Keep mock data obviously synthetic and use `@example.test` emails.
- Do not add app-owned login, direct database clients, service-role keys, direct provider API access, direct `/imports/*` calls, or external AI/search/provider egress for PlannerXchange client data. `egressDeclarations` are review evidence, not approval; non-enterprise Day 1 self-serve egress is blocked.
- Before review, run `npm run build`, then `npm run preflight`, and commit the generated `distRoot` output.
- After pushing to GitHub, use the PlannerXchange CLI when available:
  `px review watch --env dev --goal <selected-goal> --commit HEAD --format markdown`.
- Before choosing the goal, ask the builder whether the current target is `draft`,
  `marketplace`, `demo_mode`, `landing_page`, `private_label`, or `data_persistence`.
- Fix only the current required fix group returned for the selected goal,
  then rebuild, commit, push, and run the watch command again.
- If the builder asks for a public landing page, read `plannerxchange/landing-page.md`.
  Landing pages may use YouTube or Vimeo embeds, but sign in, sign up, install,
  checkout, review, follow, and demo CTAs must hand off to PlannerXchange-owned
  flows. Do not add app-owned auth, signup, password, checkout, lead-capture,
  protected PlannerXchange API, or token-handling behavior to a public landing page.
