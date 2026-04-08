# App Brief

Use this file to define the student app before writing code.

Fill in:

- problem to solve
- target advisor or client workflow
- the smallest v1 outcome that is still useful
- whether this is a simple standalone tool or a PlannerXchange-published app

Questions:

1. What specific workflow is this app replacing or improving?
2. Who will use it first: advisor, firm admin, or client?
3. Does this app persist data at all?
4. If it persists data, is that data PX canonical data or app-owned / partner-managed data?
5. If it saves builder-owned work product, should that live in PX app-data or outside PX?
6. Does the app need canonical data? PlannerXchange provides household, client, account, position, transaction, cost basis, security, and model data out-of-the-box. Which entities and permission scopes does the app need? See `data-contract.md` for available scopes and fields.
7. Does the app need to create or edit shared PlannerXchange canonical records such as households or clients? If yes, do not assume public builder write routes exist unless PlannerXchange has documented that contract explicitly.
8. Does the app need stricter intra-firm scoping, such as limiting each advisor to their own book of business?
9. Should those stricter intra-firm boundaries be configurable by firm users or admins rather than hardcoded?
10. Does the app depend on external integrations such as Wealthbox, Plaid, Altruist, Holistiplan, or another partner system?
11. Does the app render branded chrome, logos, or disclosure text that should inherit PlannerXchange private-label settings? If not, avoid requesting `branding.read` or `legal.read` just because the starter demonstrates those fields.
12. What built artifact should PlannerXchange launch for the manifest `entryPoint`, and does the production build emit the matching publish manifest?
13. Does the app need to send outbound email (for example, delivering a questionnaire link, a completed-workflow confirmation, or a report)? If yes, declare `email.send` in the manifest permissions and read `docs/builder-spec/outbound-email-v1.md` before writing any email-related code.
