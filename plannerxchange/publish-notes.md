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
- nonportable apps can still publish, but they should not claim eligibility for the PX portability contract
- `plannerxchange_portable` means the code is built to PX canonical data contracts
- builder membership tier and shell enablement decisions are handled inside PlannerXchange, not in this repo

Student checklist before linking the repo:

- confirm `plannerxchange.app.json` matches the actual app
- set the correct `dataPortabilityMode`
- keep permissions minimal
- keep the app shell-compatible
- avoid custom auth or top-level routing
- write a clear summary and description for the listing

Review guidance:

- universal security and governance checks apply to every app
- apps built to PX canonical data contracts get stricter checks for PX data access patterns
- nonportable apps may use their own backend, and they may still read approved PX canonical data, but they must not request PX-canonical scopes casually
- apps that save builder-owned work product inside PX should use the governed PX app-data contract rather than trying to mutate immutable PX reference facts
- apps that touch client data, PII, or external egress paths should expect stricter review
- Day 1 external AI-provider or third-party egress of PX client data is not allowed
- apps that pass the full PlannerXchange governance and client-data safety review may earn a `PX Approved` trust badge
- PlannerXchange may show badges such as `Portable Data` or `App-Managed Data` in the catalog
- apps that appear not to be white-label-ready may receive non-blocking risk findings

White-label readiness signals:

- if the app renders branded chrome, it should request `branding.read`
- if the app requests `branding.read`, the source should actually consume PlannerXchange branding context
- avoid hardcoded logo or favicon assets when the app is expected to inherit firm branding
- if the app shows a logo, keep sizing responsive so firm-uploaded assets still look correct even when proportions differ from the mock preview

First workshop-friendly path:

- link the repo
- publish to `dev`
- launch and verify in the firm workspace
- only later consider broader sharing or marketplace listing
