# Advisor App Starter

This template is the first local scaffold for an advisor-owned PlannerXchange app repo.

It is designed to show the minimum v1 publication shape:

- `plannerxchange.app.json`
- a shell-compatible `src/plugin.tsx` entrypoint
- a local preview host that mounts the plugin with mock PlannerXchange runtime context
- a `plannerxchange/` markdown context pack for AI-assisted student builds

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

## Builder checklist

- Keep `plannerxchange.app.json` aligned with `src/plugin.tsx`.
- Do not add app-owned login flows.
- Assume PlannerXchange owns auth, tenant resolution, branding, and disclosures.
- Build against approved PlannerXchange APIs rather than direct shared-data storage access.
- Keep requested permission scopes minimal.

## Files

- `plannerxchange.app.json`: publish manifest
- `plannerxchange/app-brief.md`: the student-facing project brief
- `plannerxchange/context.md`: platform constraints and design reminders
- `plannerxchange/data-contract.md`: current shared-data and auth assumptions
- `plannerxchange/publish-notes.md`: publication and review expectations
- `src/plugin.tsx`: PlannerXchange plugin entrypoint
- `src/main.tsx`: local preview host
- `src/dev-context.ts`: mock runtime context for local development

## Preparing `plannerxchange-template`

When you publish this starter into `https://github.com/PlannerXchange/plannerxchange-template`,
keep the template repo intentionally small:

- starter code only
- `plannerxchange/` markdown pack
- one strong README

Do not mirror the full platform docs tree into the student repo. The template should carry the
high-signal subset students and their coding agents actually need.

Use `scripts/sync-plannerxchange-template.ps1` from the platform repo to sync the exact approved
file set into a local clone of `plannerxchange-template`.
