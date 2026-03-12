# Advisor App Starter

This template is the first local scaffold for an advisor-owned PlannerXchange app repo.

It is designed to show the minimum v1 publication shape:

- `plannerxchange.app.json`
- a shell-compatible `src/plugin.tsx` entrypoint
- a local preview host that mounts the plugin with mock PlannerXchange runtime context
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

`dataPortabilityMode` is a core product choice:

- `plannerxchange_portable`
  - use this when the app is meant to participate in PlannerXchange-governed shared data portability
  - the app should use PlannerXchange APIs and shared data contracts for shared planner, firm, or client data

- `app_managed_nonportable`
  - use this when the app manages its own backend and data model
  - the app can still publish through PlannerXchange, but its app-owned data is not treated as portable across apps

## Current status

This starter is now self-contained enough to copy into a separate builder repository, including the
`plannerxchange/` markdown files that explain product constraints and workshop expectations.

It intentionally includes a local `src/plannerxchange.ts` contract shim so the public template repo
does not depend on unpublished internal packages.

## Local development

1. Copy this folder into the target builder repo.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite preview and confirm the plugin renders with the mock shell context.

## Student workflow

Recommended workshop flow:

1. student copies this starter into a new GitHub repository
2. student reads the `plannerxchange/` markdown files first
3. student uses an AI coding agent against the local repo
4. student builds an app aligned to `plannerxchange.app.json`
5. student commits and pushes to their own repository
6. student logs into PlannerXchange and links the repository for governed publication

The intended UI should require little more than the GitHub URL. PlannerXchange should read the
required metadata from `plannerxchange.app.json` and only ask for optional merchandising overrides
when needed.

## Builder checklist

- Keep `plannerxchange.app.json` aligned with `src/plugin.tsx`.
- Declare the correct `dataPortabilityMode` before linking the repo.
- Do not add app-owned login flows.
- Assume PlannerXchange owns auth, tenant resolution, branding, and disclosures.
- Use PlannerXchange APIs for shared portable data.
- If the app is intentionally nonportable, be explicit about that and avoid requesting shared-data scopes you do not need.
- Keep requested permission scopes minimal.

## Files

- `plannerxchange.app.json`: publish manifest
- `plannerxchange/app-brief.md`: the student-facing project brief
- `plannerxchange/context.md`: platform constraints and design reminders
- `plannerxchange/data-contract.md`: current shared-data, portability, and auth assumptions
- `plannerxchange/publish-notes.md`: publication and review expectations
- `src/plugin.tsx`: PlannerXchange plugin entrypoint
- `src/main.tsx`: local preview host
- `src/dev-context.ts`: mock runtime context for local development

## Scope

This repository should stay intentionally small:

- starter code only
- `plannerxchange/` markdown pack
- one strong README

Do not mirror the full platform docs tree into the student repo. The template should carry the
high-signal subset students and their coding agents actually need.
