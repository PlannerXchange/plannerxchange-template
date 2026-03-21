# Advisor App Starter

This template is the first local scaffold for an advisor-owned PlannerXchange app repo.

It is designed to show the minimum v1 publication shape:

- `plannerxchange.app.json`
- a shell-compatible `src/plugin.tsx` entrypoint
- a local preview host that mounts the plugin with mock PlannerXchange runtime context
- a production build that emits a publish manifest mapping the source `entryPoint` to the built artifact PlannerXchange will host
- a `plannerxchange/` markdown context pack for AI-assisted student builds

Required publication metadata should live in `plannerxchange.app.json` whenever possible.

Examples:

- `name`
- `slug`
- `framework`
- `visibility`
- `dataPortabilityMode`
- `categories`
- `summary`
- `description`
- optional media URLs

`dataPortabilityMode` is a build-contract choice:

- `plannerxchange_portable`
  - use this when the app uses PlannerXchange canonical data contracts
  - the app should use PlannerXchange APIs and PX-governed data contracts for firm, advisor, client, account, household, or other PX-canonical domains
  - builder-owned work product may still be saved through approved PX app-data APIs
  - this is the preferred default when the app persists PlannerXchange-governed data

- `app_managed_nonportable`
  - use this when the app's business persistence lives in app-owned or partner-managed systems rather than PX canonical data contracts
  - the app may still use approved PX app-data APIs for builder-owned work product when PX-hosted persistence is preferred
  - the app can still publish through PlannerXchange, but its app-owned data is not eligible for the PX portability contract

Important:

- this template does not teach membership-tier or entitlement rules
- `plannerxchange_portable` is an architecture declaration, not a statement about what the current builder account is allowed to enable in the shell
- platform review and product entitlements are handled inside PlannerXchange, not in this repo

## Platform Contract Map

This starter mirrors the high-signal subset of these PlannerXchange builder-spec areas:

- runtime overview
- auth and session
- canonical-data API
- app-data API
- app access and feature entitlements
- branding and legal
- publish requirements

If you have access to the PlannerXchange platform repo, review the corresponding `docs/builder-spec/` files for the full contract.

## Current status

This starter is now self-contained enough to copy into a separate builder repository, including the
`plannerxchange/` markdown files that explain product constraints and workshop expectations.

It intentionally includes a local `src/plannerxchange.ts` contract shim so the public template repo
does not depend on unpublished internal packages.

This starter is npm-first and should keep `package-lock.json` committed so installs stay repeatable
across workshop runs, AI-assisted coding sessions, and future CI checks.

The production build emits `dist/plannerxchange.publish.json`.

That file maps the manifest's source `entryPoint` such as `src/plugin.tsx` to the built JS module and
any emitted CSS assets that PlannerXchange should host and launch.

## Local development

1. Copy this folder into the target builder repo.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite preview and confirm the plugin renders with the mock shell context.
5. Run `npm run build` before publication to generate `dist/` and `dist/plannerxchange.publish.json`.

## Student workflow

Recommended workshop flow:

1. student copies this starter into a new GitHub repository
2. student reads the `plannerxchange/` markdown files first
3. student uses an AI coding agent against the local repo
4. student builds an app aligned to `plannerxchange.app.json`
5. student runs `npm run build`
6. student commits and pushes source plus the generated `dist/` output
7. student logs into PlannerXchange and links the repository for governed publication

The intended UI should require little more than the GitHub URL. PlannerXchange should read the
required metadata from `plannerxchange.app.json` and only ask for optional merchandising overrides
when needed.

## Builder checklist

- Keep `plannerxchange.app.json` aligned with `src/plugin.tsx`.
- Keep `entryPoint` source-oriented, such as `src/plugin.tsx`; do not replace it with a hashed build file.
- Run `npm run build` before publish and commit the generated `dist/` output.
- Do not hand-edit `dist/plannerxchange.publish.json`; let the build regenerate it.
- Declare the correct `dataPortabilityMode` before linking the repo.
- Do not add app-owned login flows.
- Assume PlannerXchange owns auth, tenant resolution, branding, and disclosures.
- Configure your router `basename` to the `appBasename` value from the shell context props (`/apps/<your-app-slug>`). Use `BrowserRouter` (or Vue Router with `createWebHistory`) — not `MemoryRouter` — so deep links and browser history work correctly.
- Do not add auth routes, sign-in pages, or routes outside your `/apps/<appSlug>` prefix.
- Initialize your router at the `initialPath` context prop so deep links land on the correct view.
- If the app renders branded chrome, inherit logo, favicon, primary color, secondary color, and font color from PlannerXchange runtime context instead of hardcoding one static brand.
- Use PlannerXchange APIs and canonical contracts for PX-governed data.
- Save builder-owned work product such as scenarios, recommendations, questionnaire responses, and projections through approved PX app-data APIs or explicit app-owned persistence.
- Treat `firmId` as the maximum data boundary for PX canonical data. Stricter intra-firm scoping is fine; broader scope is not.
- If the app is nonportable, it may still read approved PX canonical data through PX APIs by default.
- If the app is intentionally nonportable, be explicit about that and avoid requesting PX-canonical scopes you do not need.
- Do not treat immutable PX reference facts as app-writable just because the app can read them.
- Keep requested permission scopes minimal.
- If the app shows a logo, size it responsively because different firms may upload different logo proportions.

## Files

- `plannerxchange.app.json`: publish manifest
- `plannerxchange/app-brief.md`: the student-facing project brief
- `plannerxchange/context.md`: platform constraints and design reminders
- `plannerxchange/data-contract.md`: current PX canonical data, portability, and auth assumptions
- `plannerxchange/publish-notes.md`: publication and review expectations
- `src/plugin.tsx`: PlannerXchange plugin entrypoint
- `src/main.tsx`: local preview host
- `src/dev-context.ts`: mock runtime context for local development
- `dist/plannerxchange.publish.json`: generated publish manifest that maps source `entryPoint` values to built artifact files

## Scope

This repository should stay intentionally small:

- starter code only
- `plannerxchange/` markdown pack
- one strong README

Do not mirror the full platform docs tree into the student repo. The template should carry the
high-signal subset students and their coding agents actually need.

This repository is the public builder starter only. Internal platform architecture, persistence,
security, KMS, infrastructure, and runbook docs remain private in `plannerxchange-platform` and are
not duplicated here.
