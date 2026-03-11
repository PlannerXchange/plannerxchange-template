# Publish Notes

All PlannerXchange-published apps go through the same governed pipeline.

Current publication concepts:

- environments: `dev`, `prod`
- visibility: `private`, `shared_with_specific_users`, `marketplace_listed`

Important:

- `dev` and `prod` are PlannerXchange-managed publication targets
- installation is separate from publication
- marketplace listing is separate from selective sharing

Student checklist before linking the repo:

- confirm `plannerxchange.app.json` matches the actual app
- keep permissions minimal
- keep the app shell-compatible
- avoid custom auth or top-level routing
- write a clear summary and description for the listing

First workshop-friendly path:

- link the repo
- publish to `dev`
- launch and verify in the firm workspace
- only later consider broader sharing or marketplace listing
