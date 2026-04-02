# PlannerXchange Branding and Legal API

This document defines how builder apps consume white-label branding and legal/disclosure context from PlannerXchange.

## Core rule

Apps should consume PlannerXchange-provided branding and legal context at runtime rather than hardcoding one static firm brand. This is required for white-label behavior across firms, consistent disclosure handling, and safer publication review.

Important distinction: public builder profile identity (creator avatar, display name, firm affiliation) is separate from app runtime branding. White-label branding resolves from PlannerXchange context at runtime, not from the builder profile.

## Branding scopes and fallback

Branding can exist at three levels. The most specific level wins:

1. **Firm** (most specific)
2. **Enterprise**
3. **PlannerXchange default** (fallback)

## `GET /branding/current`

**Required scope:** `branding.read`

**Response:**

```json
{
  "branding": {
    "resolvedFrom": "firm",
    "profileId": "branding_123",
    "logoUrl": "https://cdn.plannerxchange.ai/logo.svg",
    "faviconUrl": "https://cdn.plannerxchange.ai/favicon.png",
    "primaryColor": "#102033",
    "secondaryColor": "#DDA94B",
    "fontColor": "#ffffff",
    "supportEmail": "support@firm.com"
  },
  "fallbacksApplied": ["faviconUrl"]
}
```

The `fallbacksApplied` array indicates which fields were resolved from a broader scope because the firm did not provide them.

### Fallback behavior

| Missing field | Fallback |
|---------------|----------|
| `logoUrl` | PlannerXchange default mark plus firm name treatment |
| `faviconUrl` | Resolved logo mark or PlannerXchange default icon |
| `secondaryColor` | PlannerXchange secondary color |
| `fontColor` | PlannerXchange default light-on-dark shell contrast |
| `supportEmail` | PlannerXchange default support contact |

## Legal and disclosure scopes

Legal settings support four specificity levels, but the merge behavior is **not** a simple "most specific wins" model.

Enterprise disclosures may be **mandatory** — they are always rendered even when firm or app disclosures exist. The effective display order is:

1. **Enterprise mandatory** disclosure block (always shown when set)
2. **Firm** disclosure block (appended if enterprise policy permits)
3. **App-specific** disclosure block (appended if enterprise policy permits)
4. **PlannerXchange default** (fallback only where no other disclosure exists)

Enterprise policy controls how these layers combine:

| `legal_merge_mode` | Behavior |
|--------------------|----------|
| `enterprise_only` | Only enterprise disclosure is shown; firm and app blocks are suppressed |
| `append_firm` | Enterprise block shown first, then firm block appended |
| `append_firm_and_app` | Enterprise block, then firm block, then app block (all shown) |
| `replace_allowed` | Most-specific-wins: app > firm > enterprise > PX default |

The `GET /legal/current` response already resolves the correct merged result for the current context.

Builder rule: always render the `disclosureText` returned by the API as-is. Do not selectively hide portions of the disclosure, skip rendering when the text appears duplicated, or attempt to merge disclosure layers in app code — PlannerXchange resolves the correct combined disclosure on the server.

## `GET /legal/current`

**Required scope:** `legal.read`

**Response:**

```json
{
  "legal": {
    "resolvedFrom": "app",
    "profileId": "legal_123",
    "disclosureText": "Approved for advisor use inside PlannerXchange.",
    "privacyPolicyUrl": "https://firm.com/privacy",
    "termsUrl": "https://firm.com/terms"
  },
  "fallbacksApplied": []
}
```

### Fallback behavior

| Missing field | Fallback |
|---------------|----------|
| `privacyPolicyUrl` | Next broader legal scope |
| `termsUrl` | Next broader legal scope |
| `disclosureText` | Next broader legal scope |

## Brand asset standards

**Logo:**
- `svg` preferred, transparent `png` acceptable
- Recommended minimum width: `512px`
- Max file size: `1 MB`
- Apps should allow the rendered logo height to constrain naturally; do not stretch

**Favicon:**
- Square `svg`, `png`, or `ico`
- Recommended raster minimum: `256x256`
- Max file size: `256 KB`
- Prefer a simple mark; avoid full wordmarks

**Theme colors:**
- `primaryColor`: required (hex value)
- `secondaryColor`: optional (hex value)
- `fontColor`: optional but recommended when the app renders colored surfaces (hex value)

## White-label-ready UI guidance

An app is considered white-label ready when it:

- consumes PlannerXchange branding context instead of bundling one fixed logo
- sizes logos responsively rather than assuming one exact width or aspect ratio
- tolerates missing logo and favicon values cleanly
- uses resolved `primaryColor`, `secondaryColor`, and `fontColor` when branded chrome is app-owned
- keeps legal text and links driven by PlannerXchange context where disclosures are shown

## Publication review signals

Review may add non-blocking white-label readiness findings when:

- the app renders branded chrome but does not request `branding.read`
- the app requests `branding.read` but the source does not consume PlannerXchange branding context
- the app references a hardcoded logo or favicon asset

These are risk findings, not automatic hard-stop failures.

## Builder rules

- do not hardcode firm branding into app code
- do not hardcode legal text when PlannerXchange provides a disclosure context
- if the app renders branded chrome, request `branding.read`
- if the app renders disclosure text or links, request `legal.read`
- write the app so the same codebase looks correct across multiple firms
