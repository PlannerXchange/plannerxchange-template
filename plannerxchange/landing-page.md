# Public Landing Page Guidance

Use this file when the builder asks for a public PlannerXchange landing page
for an app.

PlannerXchange landing pages are optional marketplace niceties, similar to demo
mode. They are reviewed separately from normal draft or marketplace readiness.
They are not a new publication lane and they are not manifest capability fields.

## Core Model

The canonical public app URL remains:

```text
/marketplace/apps/{slug}
```

If PlannerXchange has not approved or enabled a custom landing page, the normal
PlannerXchange-rendered marketplace app detail page remains the public page.

Do not add any of these fields to `plannerxchange.app.json`:

- `landingPage`
- `landing_page`
- `publicLandingPage`
- `landingPageEnabled`
- `supportsLandingPage`
- `capabilities`
- `marketplace`
- `marketplaceDistribution`
- `portableData`
- `demoMode`
- `demoModeEnabled`
- `supportsDemoMode`

If the builder wants landing-page review, use the review goal:

```bash
px feedback --env dev --goal landing_page --commit HEAD --format markdown
```

Fix landing-page findings only when the builder selected `landing_page`, unless
the finding is also a universal blocker such as secrets, malware, unsafe
dependencies, manual token handling, or app-owned authentication.

## What To Build

A compliant landing page may include:

- clear app positioning and workflow explanation
- public screenshots or illustrations that contain only synthetic data
- YouTube or Vimeo demo, walkthrough, or explainer embeds
- marketplace-safe benefit copy
- CTA definitions that hand off to PlannerXchange-owned routes
- public pricing or trust references only when those values come from
  PlannerXchange marketplace records

Keep the page public-safe. It must not require firm context, user context, app
installation context, protected PlannerXchange APIs, canonical data, app-data
records, or client data.

Until PlannerXchange publishes a dedicated custom landing-page artifact
contract, keep landing-page work as source code that can be reviewed, but do not
invent a manifest field, deploy a standalone public URL, or claim that a custom
landing page is live. PlannerXchange decides when the reviewed surface is
enabled.

## CTA Rules

Landing-page CTAs are allowlisted actions. The builder may choose user-facing
labels, but PlannerXchange owns the final route, auth handoff, install
authority, checkout handoff, review rules, and return intent.

Use CTA records like this in app source or local fixtures:

```ts
type LandingPageCtaKind =
  | "watch_video"
  | "try_demo"
  | "sign_in"
  | "sign_up"
  | "install"
  | "checkout"
  | "follow_builder"
  | "leave_review"
  | "view_builder_profile"
  | "view_pricing"
  | "read_reviews";

const landingPageCtas: Array<{ kind: LandingPageCtaKind; label: string }> = [
  { kind: "watch_video", label: "Watch demo" },
  { kind: "sign_up", label: "Get started" },
  { kind: "install", label: "Install in PlannerXchange" }
];
```

Approved examples:

| Label | CTA kind | Required behavior |
| --- | --- | --- |
| `Watch demo` | `watch_video` | Open or scroll to an embedded YouTube or Vimeo video. |
| `See how it works` | `watch_video` | Open approved public media without auth. |
| `Try demo` | `try_demo` | Open the PX demo route only when demo mode is eligible and enabled. |
| `Get started` | `sign_up` or `install` | Hand off to PX account creation or install flow with return intent. |
| `Sign up` | `sign_up` | Hand off to PX account creation with return intent. |
| `Sign in` | `sign_in` | Hand off to PX sign-in with return intent. |
| `Install` | `install` | Hand off to PX install after auth and entitlement checks. |
| `Subscribe` | `checkout` | Hand off to PX-owned checkout or paid-install flow. |
| `Follow builder` | `follow_builder` | Hand off to PX auth before writing the follow. |
| `Leave review` | `leave_review` | Hand off to PX auth and installed-user review rules. |
| `View pricing` | `view_pricing` | Show PX marketplace pricing data. |

PlannerXchange preserves the public marketplace, app-detail, or builder-profile
page where an install action began and returns the visitor there with a
PlannerXchange-owned result callout. The installed app and Dashboard remain
explicit user choices. Landing-page code must not read the result URL as proof
of installation or entitlement; only the authenticated shell/runtime context
can establish that state.

Do not hardcode app-owned destinations for protected actions. For example, do
not implement `/signup`, `/login`, `/checkout`, or `/billing` routes inside the
app and do not point landing-page buttons to builder-owned equivalents.

## Video Embeds

YouTube and Vimeo embeds are allowed without separate PlannerXchange approval
when used for public app demos, walkthroughs, or explainers.

Use normal embed URLs:

```tsx
<iframe
  title="Demo video"
  src="https://www.youtube.com/embed/VIDEO_ID"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  allowFullScreen
/>
```

```tsx
<iframe
  title="Demo video"
  src="https://player.vimeo.com/video/VIDEO_ID"
  allow="autoplay; fullscreen; picture-in-picture"
  allowFullScreen
/>
```

Do not add custom YouTube, Vimeo, analytics, ad, tracking, lead-capture, or tag
manager scripts. An iframe embed is acceptable; arbitrary third-party scripts
remain review-sensitive.

## Disallowed Patterns

Landing pages must not:

- render app-owned login, signup, password, invite, verification, or reset flows
- collect passwords, one-time codes, OAuth credentials, API keys, source
  credentials, billing details, or payment details
- create PlannerXchange users, firms, memberships, app installations, reviews,
  follows, checkout sessions, or billing records directly
- call protected PlannerXchange APIs from public unauthenticated code
- use `ShellRuntimeContext.authenticatedFetch` from a public landing context
- read, store, or manually attach PlannerXchange bearer tokens
- use Cognito, Auth0, Clerk, Firebase, Supabase auth, or similar app-owned auth
  providers for PlannerXchange marketplace users
- open builder-owned Stripe checkout, payment pages, coupon pages, or billing
  portals
- post `Book demo`, `Contact us`, `Join waitlist`, or similar public forms to a
  builder-owned CRM, form provider, calendar provider, or webhook unless
  PlannerXchange later approves a specific form contract
- ask users to connect Wealthbox, Altruist, Holistiplan, custodians, CRMs, tax
  tools, or other provider accounts from the public page
- accept CSVs, spreadsheets, files, uploads, or client data on the public page
- claim `PX Approved`, `Portable Data`, marketplace availability, pricing,
  reviews, ratings, install availability, or security approval unless those
  values are read from PlannerXchange marketplace records

Do not write code like this:

```tsx
<form action="/signup" method="post">
  <input type="email" name="email" />
  <input type="password" name="password" />
  <button>Create account</button>
</form>

<a href="https://buy.stripe.com/example">Subscribe</a>
<a href="https://calendly.com/example/demo">Book demo</a>
```

Use PlannerXchange-owned CTA handoff instead.

## Data And Mock Content

Landing pages are public. Treat every screenshot, fixture, test record, and demo
video frame as public content.

Rules:

- use obviously synthetic names, firms, households, accounts, and emails
- use `@example.test` for mock email addresses
- do not include real advisor, firm, client, household, account, tax, CRM,
  transaction, or document data in source, screenshots, videos, or fixtures
- do not show live PlannerXchange data on the public page
- do not call canonical, app-data, workspace, builder, admin, integration, or
  import routes from public landing code

## Local Preflight

Before asking for landing-page review:

```bash
npm run build
npm run preflight
git add .
git commit -m "Add PlannerXchange landing page"
git push
px feedback --env dev --goal landing_page --commit HEAD --format markdown
```

Local preflight catches only obvious issues. PlannerXchange review still owns
the final landing-page eligibility decision. Run `npm run preflight` only when
the app repo defines that script; otherwise run `npm run check` when defined.

If review returns required fixes for `landing_page`, fix that current group,
rebuild, run the available validation, commit, push, and run the same watch command again.
The `landing_page` goal filters findings from the latest full review; it does
not start a landing-page-only review or rerun pipeline stages.
