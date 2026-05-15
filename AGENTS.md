# PlannerXchange Student App Agent Guide

This repository is a PlannerXchange app starter. Treat it as the working app repo, not as reference docs copied into another project.

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
- Do not add app-owned login, direct database clients, service-role keys, direct Wealthbox/Altruist access, direct `/imports/*` calls, or external AI/provider egress for PlannerXchange client data.
- Before publication, run `npm run build`, then `npm run preflight`, and commit the generated `distRoot` output.

