# PlannerXchange Context

PlannerXchange owns:

- authentication
- top-level routing
- branding and legal framing
- publication governance
- tenant and firm context

Builder apps should not:

- implement their own login flow
- assume control of the top-level domain
- bypass PlannerXchange publication rules

The `framework` field in the manifest is descriptive metadata for review and support context.
What PlannerXchange actually needs is a shell-compatible web artifact with a stable entry point.

Common frontend values:

- `react`
- `vue`
- `nextjs`
- `html-js`

Styling is flexible:

- plain CSS
- CSS modules
- Tailwind
- Sass
- component-library styling

Choose the smallest stack that fits the app.

Data portability is also an explicit product choice:

- `plannerxchange_portable`
  - use PlannerXchange-governed APIs and shared-data contracts for shared advisor, firm, or client data

- `app_managed_nonportable`
  - you may use your own backend and data model for app-owned data
  - the app can still publish through PlannerXchange if it passes security and governance review

Do not treat app-managed data as if it were PlannerXchange-portable shared data.
