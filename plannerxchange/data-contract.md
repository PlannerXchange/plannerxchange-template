# Data Contract Notes

Use these rules while building:

- treat PlannerXchange as the source of auth and session context
- consume runtime context from the shell/plugin contract
- do not invent separate planner identity or tenant models
- assume shared data and governed APIs are stricter than standalone frontend code

Current practical reality:

- lightweight apps can be mostly frontend-first
- richer shared-data workflows will depend on PlannerXchange APIs
- if the app only needs a simple calculator or worksheet, keep it lightweight

Before adding data writes, decide:

1. Is this really shared PlannerXchange data?
2. Does this belong in a future governed API rather than app-local storage?
3. Does this app need client-level access or only firm/advisor context?
