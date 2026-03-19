# Data Contract Notes

Use these rules while building:

- treat PlannerXchange as the source of auth and session context
- consume runtime context from the shell/plugin contract
- do not invent separate planner identity or tenant models
- do not treat firm creation, user creation, invitation acceptance, or membership assignment as app-owned builder responsibilities
- assume PX canonical data contracts and governed APIs are stricter than standalone frontend code
- decide early whether the app is `plannerxchange_portable` or `app_managed_nonportable`

Current practical reality:

- lightweight apps can be mostly frontend-first
- richer PX-data workflows will depend on PlannerXchange APIs
- if the app only needs a simple calculator or worksheet, keep it lightweight
- builder apps primarily consume PX runtime context and approved data reads; they do not provision firms or users

If the app is `plannerxchange_portable`:

- use PlannerXchange-governed APIs for PX canonical data
- use approved PX app-data APIs for builder-owned work product when the app needs to save recommendations, scenarios, questionnaire responses, projections, or similar records inside PX
- treat `firmId` as the maximum data boundary
- builders may add stricter intra-firm scoping such as per-`advisor_user` access
- expect stricter review for permissions, client-data access, and external egress
- do not assume app-owned direct database access for PX canonical data
- do not assume raw KMS access or direct decrypt capability
- do not persist decrypted PX client data in local storage, IndexedDB, analytics beacons, or client-side logs

If the app is `app_managed_nonportable`:

- you may use your own backend or partner-managed systems for app-owned data
- you may also use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
- you may still read approved PX canonical data through PX APIs by default when the app needs it for runtime behavior
- you still must pass PlannerXchange security and publication review
- do not request PX client-data scopes unless the app truly needs PX canonical client or account data
- label the app honestly as app-managed rather than portable
- app-owned data is not eligible for the PX portability contract

Use these provenance buckets:

- PX canonical data
  - data that should follow the firm across multiple apps

- app-owned data
  - app-specific workflow state, derived outputs, or proprietary records that do not need to become portable

- integration-exposed data
  - partner-system data that remains in the third-party system but is surfaced through PlannerXchange-governed integrations

Rule:

- if a field should follow the firm across apps, it should move into a PX canonical or approved integration-exposed contract instead of staying app-local only
- PX-hosted app-owned work product does not become canonical or portable by default just because PX stores it

Reference facts versus work product:

- immutable PX reference facts such as account identifiers, positions, and transactions should not be treated as app-writable
- builder-owned work product such as recommendations, questionnaire responses, scenarios, and projections should be saved separately through approved PX app-data APIs or explicit app-owned persistence

Worked patterns:

1. PX client data plus PX app-data
   Rebalancer app reads PX canonical client and account summaries, then saves `recommendation_set` records through PX app-data. The recommendations are governed and exportable, but they are not canonical across apps by default.
2. Partner data plus PX app-data
   Cashflow app reads Plaid or other partner data through PX-governed integration paths, then saves `projection_run` records through PX app-data. The partner facts stay partner-sourced; the projections are builder-owned work product.
3. App-managed nonportable
   Marketing or content app may use no PX client data at all and may keep its own outputs in app-owned storage. It can still publish through PlannerXchange, but it should not imply its app-owned data is portable.

Provenance-aware UI guidance:

- show where a record came from, such as PX canonical data, partner integration, manual entry, or app upload
- show the `asOf` date when the app is rendering partner-sourced or imported information
- keep partner-sourced labels visible so users do not confuse third-party reference facts with app-authored recommendations or projections

Before adding data writes, decide:

1. Is this PX canonical data or app-owned / partner-managed data?
2. If it is PX canonical data, is it an immutable reference fact that should remain read-only, or an explicitly approved PX write contract?
3. If it is app-owned or partner-managed, is this app intentionally `app_managed_nonportable`?
4. Does this app need client-level access, account-level access, or only firm/advisor context?
5. Does the builder want stricter sub-scoping inside the firm?
6. Should that stricter sub-scoping be configurable by the firm or user path rather than hardcoded?
