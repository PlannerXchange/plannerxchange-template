# Data Contract Notes

Use these rules while building:

- treat PlannerXchange as the source of auth and session context
- consume runtime context from the shell/plugin contract
- do not invent separate planner identity or tenant models
- assume shared data and governed APIs are stricter than standalone frontend code
- decide early whether the app is `plannerxchange_portable` or `app_managed_nonportable`

Current practical reality:

- lightweight apps can be mostly frontend-first
- richer shared-data workflows will depend on PlannerXchange APIs
- if the app only needs a simple calculator or worksheet, keep it lightweight

If the app is `plannerxchange_portable`:

- use PlannerXchange-governed APIs for shared planner, firm, or client data
- expect stricter review for permissions, data flows, and external egress
- do not use app-owned direct database access for shared portable data

If the app is `app_managed_nonportable`:

- you may use your own backend and your own data model for app-owned data
- you still must pass PlannerXchange security and publication review
- do not request shared client-data scopes unless the app truly needs PlannerXchange-managed shared data
- label the app honestly as app-managed rather than portable

Before adding data writes, decide:

1. Is this really shared PlannerXchange data?
2. If yes, does this belong in a governed PlannerXchange API rather than app-local storage?
3. If not, is this app intentionally app-managed and nonportable?
4. Does this app need client-level access or only firm/advisor context?
