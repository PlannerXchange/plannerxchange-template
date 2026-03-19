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

For data architecture, default to PX canonical contracts whenever the app needs PlannerXchange data:

- `plannerxchange_portable`
  - use PlannerXchange-governed APIs and PX canonical data contracts
  - use this when the app needs firm, advisor, client, household, account, or other PX-governed data domains

- `app_managed_nonportable`
  - use this when the app's business data lives in app-owned or partner-managed systems
  - the app can still publish through PlannerXchange if it passes security and governance review
  - app-owned data is not eligible for the PX portability contract

Boundary rule:

- `firmId` is the maximum PX canonical data boundary
- builders may impose stricter intra-firm scoping such as per-`advisor_user` access
- stricter intra-firm scoping should preferably be configurable by the builder, firm, or user path rather than hardcoded as one fixed visibility model
- builders should never assume cross-firm data access

Data provenance model:

- PX canonical data
  - should follow the firm across apps

- app-owned data
  - may live in app-owned systems or approved PX app-data storage and remain outside the PX portability contract

- integration-exposed data
  - may remain in approved partner systems and be surfaced through PX-governed integration paths

Reference facts versus work product:

- immutable PX or partner reference facts such as account identifiers, positions, and transactions should not be treated as generically app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, and projections should be saved separately through approved PX app-data APIs or explicit app-owned persistence

Important:

- this repo does not encode the builder's PlannerXchange membership tier
- build to the PX canonical contract when the app needs PX-governed data
- platform review and shell enablement decisions happen inside PlannerXchange
- the app should consume PX runtime and data APIs; it should not try to create firms, create users, accept invitations, or own identity provisioning flows
