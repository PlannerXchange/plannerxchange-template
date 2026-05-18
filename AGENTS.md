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
- Do not invent manifest fields from review labels. Do not add `capabilities`, `marketplace`, `portableData`, `demoMode`, `demoModeEnabled`, or `supportsDemoMode`.
- Use `visibility: "marketplace_listed"` for marketplace intent.
- Use `dataPortabilityMode: "plannerxchange_portable"` for portable-data intent.
- Use exact scope strings in `permissions` for PlannerXchange API access.
- Demo mode is enabled from Creator Studio after review eligibility; it is not currently a builder manifest field.
- PlannerXchange owns auth, routing, shell context, disclosure, publication review, and app installation identity.
- Use `ShellRuntimeContext.authenticatedFetch` for protected PlannerXchange API calls.
- Keep mock data obviously synthetic and use `@example.test` emails.
- Do not add app-owned login, direct database clients, service-role keys, direct provider API access, direct `/imports/*` calls, or external AI/provider egress for PlannerXchange client data.
- Before review, run `npm run build`, then `npm run preflight`, and commit the generated `distRoot` output.
- After pushing to GitHub, use the PlannerXchange CLI when available:
  `px review watch --env dev --goal <selected-goal> --commit HEAD --format markdown`.
- Before choosing the goal, ask the builder whether the current target is `draft`,
  `marketplace`, `demo_mode`, `private_label`, or `data_persistence`.
- Fix only the current required fix group returned for the selected goal,
  then rebuild, commit, push, and run the watch command again.
