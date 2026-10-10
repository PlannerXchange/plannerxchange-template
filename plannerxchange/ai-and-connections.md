# AI And Connection Intent

Updated: 2026-10-09
Status: current interview guidance; PX-managed app AI and generic Connections
are planned, not released manifest/SDK capabilities.

Internal funding-reservation groundwork and shared `AppAi*` funding types do
not release a model, payment or funding API. Do not infer an SDK method,
manifest field or CLI command from those types; authenticated runtime and
funding activation remain unavailable.

Dev sandbox enrollment administration is being wired into shell-only endpoints.
Shared availability and enrollment types describe that internal shell flow. Do
not call those endpoints from an app or infer an SDK method, manifest permission
or CLI command. Eligibility and an empty funding account do not grant model
access, payment consent or spendable credit.

Local shell consent/budget settings and shared `AppAiFundingSettings*` /
`AppAiConsent*` types remain internal. Do not call these routes from an app,
issue an AI review approval, or treat ordinary publication approval as AI approval.
The shell requires current version-specific reviewed readable terms. A private
platform reviewer service now binds an explicit AI review to publication evidence;
do not call it from an app or infer automatic AI approval from publication.
Reviewer tooling, cross-firm builder administration, paid funding and model
execution remain pending; these controls do not release an SDK or manifest capability.

## Planned payment options for AI built into an app

Yes: a builder can include AI in the app and charge its model usage to the app's
customer through PX. This subscriber-paid managed option is part of MVP scope;
the customer does not need to bring an API key.

| Option | Who pays model usage? | How funding works |
| --- | --- | --- |
| Built-in AI, customer pays through PX | Subscribing firm | Customer authorizes and prepays an app-specific AI balance; metered usage reduces it, with optional authorized auto-recharge |
| Built-in AI, builder sponsors usage | Builder firm | Builder funds the app's model usage and sets spending allowances |
| BYOK | Designated key-owning payer | Payer connects an eligible provider account and pays that provider/gateway directly |

In Creator Studio's Payment/Pricing section, the builder will choose who pays
model costs and which funding routes are supported. The designated payer then
chooses an available route and controls its budget and recharge authorization.
App purchase/subscription pricing is separate: a free or paid app can use
subscriber-paid AI. Builder-paid Metronome and attributable Stripe service fees
remain separate from the subscriber's model credits.

Example: Cashflow includes AI transaction classification. The builder chooses
the model and subscriber-paid managed usage. Each subscribing firm funds its own
Cashflow AI balance; classification usage is metered against that balance.
The builder continues to cover the billing-service fees.

For MVP, "end-user pays" means the subscribing firm pays for its authorized
users. Separate personal/end-investor billing accounts are not included. These
are planned feature options; the availability limits above still apply.

## Interview before implementing an integration

The builder's coding agent can collect intent before Creator Studio is used.
Use answers already provided and ask only relevant follow-ups in plain language:

1. What should AI do, and is it required for the app to work?
2. What information would it process, and whose information is it?
3. Should your firm cover model costs, or should each subscribing firm pay?
4. Should the payer connect its provider account or buy managed usage through PX?
5. Which currently compatible model do you approve after reviewing its source-dated rates and estimated workload cost?
6. What run, app, monthly and sponsored-user allowances should apply?
7. Do you want automatic recharge, with what threshold, target and payment cap?
8. Who should review the output before it changes shared PX information?
9. Does the app need another API, such as BLS? What operation requires its key?

Explain the implications before treating the answers as settled:

- BYOK means the key owner pays its provider or gateway directly. PX still
  controls approved data use and budgets for work routed through PX.
- For planned managed usage using Metronome, the builder pays all Metronome
  service costs and attributable Stripe payment/billing fees even when subscribing
  firms pay model costs. Keep these service fees separate from model credits.
  Actual vendor charges and allocation require disclosure and acceptance before activation.
- Metronome is selected for managed billing, with no additional PX margin in MVP. Model funds are earmarked by payer firm and app.
- No-expiry credits are conditional on actual Metronome validity; do not promise perpetual credits or show expired balances as spendable.
- A consumption budget and an automatic-recharge limit are separate controls.
- A linked bank account is not automatically an authorized, funded payment method.
- Sponsoring AI does not grant access to subscriber information. Provider-account
  logging must not expose another firm's prompts or responses to the builder.
- A stored API key will not authorize an arbitrary external endpoint. Future
  non-AI connections require a supported, reviewed PX adapter.

Never ask the builder to paste a key into chat, CLI arguments, a planning file,
source code, a manifest, browser storage, build output or a review export.
Credential entry and payment consent belong in secure PX-owned flows once live.

## Record intent without inventing support

Until a released contract exists, record the non-secret answers in the app's
existing planning document. Mark the requested integration planned/unavailable;
use synthetic fixtures for the intended user experience. A local plan is not a
runtime declaration, a payment authorization or permission to transmit PX data.

Do not add guessed `usesAI`, `aiCapabilityDeclarations`, `connections` or similar
fields to `plannerxchange.app.json`. Do not invent an AI SDK helper, permission,
review goal or `px` subcommand. Do not add a direct provider call, frontend key,
or custom proxy to work around the missing capability. Existing publish rules
remain in effect; see `plannerxchange/publish-notes.md`.

When the feature is released, use the exact current types/SDK and documented
manifest contract. The same reviewed intent will inform Creator Studio and
agent workflows; material conflicts must be resolved before activation.
Refresh current context and review feedback rather than assuming this dated
availability statement remains current indefinitely.

## Current model and cost discovery when the feature ships

The builder controls the app's active model from Creator Studio's existing
Payment/Pricing section. At feature release, interview agents must use PX's
documented read-only model catalog and cost-preview interface. PX fetches
managed model/rate data directly from Metronome server-side and filters it for
provider availability, reviewed app compatibility and data policy. Studio and
CLI must present the same source-dated choices; billing support alone does not
prove a model is compatible with the app.

1. Refresh this context pack and inspect current CLI help for the released
   catalog/preview capability. No command name or API route is released here.
2. Retrieve current eligible models/rates and their freshness through that
   supported PX interface. Do not request PX's Metronome token or use a static
   price table from this template. If retrieval is unavailable, record a
   provisional preference and explain the missing capability.
3. Present model/publisher/serving provider, unit prices, an estimate with stated
   input/output/cache and batch assumptions, and separate model/gateway and
   builder service costs. Do not run a paid model just to display an estimate.
4. Obtain the builder's approval of the selected model and cost implications;
   retain the non-secret choice and source timestamp in the app plan. Final
   activation and billing consent use secure Creator Studio flows.

The future app calls a declared operation, not a hardcoded model. A versioned
Studio model change governs new jobs across installations without a code release,
subject to compatibility review, firm consent, BYOK support and budgets. Paying
firms retain those controls; they do not independently select the app model in
MVP. Never silently switch a payer or spend source to accommodate a model change.
App-access pricing and AI funding share the existing settings area but remain
separate obligations; free installation does not imply free AI.

## CLI boundary

The coding agent conducts the interview and can edit authorized local app files.
PX CLI v1 currently reads review feedback; planned catalog/preview reads do not authorize remote writes. It does not remotely change billing, credentials,
consent, app settings or publication. Recording an answer does not authorize
those actions. Continue using documented `px feedback` behavior and existing
goal names; do not treat AI intent as a newly released CLI command or goal.
