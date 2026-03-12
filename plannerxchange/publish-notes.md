# Publish Notes

All PlannerXchange-published apps go through the same governed pipeline.

Current publication concepts:

- environments: `dev`, `prod`
- visibility: `private`, `shared_with_specific_users`, `marketplace_listed`
- data portability: `plannerxchange_portable`, `app_managed_nonportable`

Important:

- `dev` and `prod` are PlannerXchange-managed publication targets
- installation is separate from publication
- marketplace listing is separate from selective sharing
- portability is separate from visibility
- nonportable apps can still publish, but they should not claim PlannerXchange-managed cross-app data portability

Student checklist before linking the repo:

- confirm `plannerxchange.app.json` matches the actual app
- set the correct `dataPortabilityMode`
- keep permissions minimal
- keep the app shell-compatible
- avoid custom auth or top-level routing
- write a clear summary and description for the listing

Review guidance:

- universal security and governance checks apply to every app
- portable apps get stricter checks for shared-data access patterns
- nonportable apps may use their own backend, but they must not request shared-data scopes casually
- PlannerXchange may show badges such as `Portable Data` or `App-Managed Data` in the catalog

First workshop-friendly path:

- link the repo
- publish to `dev`
- launch and verify in the firm workspace
- only later consider broader sharing or marketplace listing
