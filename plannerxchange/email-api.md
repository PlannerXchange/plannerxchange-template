# PlannerXchange Outbound Email API

This document defines how builder apps send transactional email through PlannerXchange.

## Core rule

Builder apps do not hold email credentials. All outbound email is sent through the PlannerXchange-managed relay. The app declares `email.send` in the manifest, calls a single API endpoint, and PlannerXchange handles transport, compliance audit, and sending-identity resolution.

## When to use

Use this API for transactional email only:

- deliver a questionnaire link to a client
- confirm receipt of a completed workflow step
- send a scheduled report or projection PDF
- notify a client that a recommendation is ready for review

Do **not** use this API for:

- bulk marketing or promotional campaigns
- cold outreach not connected to a specific workflow event
- recurring newsletters unrelated to a specific app event
- identity lifecycle emails (invite, verification, password reset) — PlannerXchange owns those

## Manifest declaration

The app manifest (`plannerxchange.app.json`) must include `"email.send"` in the `permissions` array:

```json
{
  "permissions": ["tenant.read", "user.read", "email.send"]
}
```

Apps that call the email API without `email.send` declared receive `403 Forbidden`.

Declaring `email.send` triggers an enhanced review step evaluating:

- whether the email use case is transactional
- whether the payload appropriately identifies the sending app
- whether the content type complies with firm-level disclosure rules
- whether a reply-to or contact path is provided

## Sending identity resolution

PlannerXchange resolves the sending identity at runtime:

1. **Firm-verified sending address** — if the firm completed SES identity verification, email is sent from that verified address
2. **PlannerXchange platform relay** — otherwise, email is sent from `noreply@plannerxchange.ai` with the firm name or app name in the display label
3. *(Phase 2)* **Linked Gmail or Outlook account** — if the firm or advisor linked an OAuth-based mailbox, that mailbox is used as the sending account

The `reply-to` may be set to the advisor's email so client replies route back to the advisor. The app should not assume a specific from address.

## `POST /app-email/send`

Send a single transactional email on behalf of the app.

**Authentication:** use `ShellRuntimeContext.authenticatedFetch`. The shell attaches user auth and `x-plannerxchange-app-installation-id`.

**Request body:**

```json
{
  "to": "client@example.test",
  "toName": "Avery Example",
  "subject": "Your onboarding questionnaire is ready",
  "htmlBody": "<p>Hi Avery, please complete your questionnaire at the link below.</p>",
  "textBody": "Hi Avery, please complete your questionnaire at: https://...",
  "replyTo": "advisor@example.test",
  "fromLabel": "Aditi Kapadia via REWealth Financial",
  "clientUserId": "client_456",
  "appRecordId": "appdata_789",
  "templateSlug": null
}
```

### Field rules

| Field | Required | Notes |
|-------|----------|-------|
| `to` | yes | Recipient email address. Synthetic test values blocked in prod. |
| `toName` | no | Recipient display name for the greeting. |
| `subject` | yes | Plain text, max 200 characters. |
| `htmlBody` | yes | Full HTML body. PlannerXchange appends a firm disclosure footer. |
| `textBody` | no | Plain-text fallback. Auto-generated from `htmlBody` if omitted. |
| `replyTo` | no | Defaults to active user's email. |
| `fromLabel` | no | Display name for the from field. Cannot impersonate unrelated brands. |
| `clientUserId` | no | Links email to a client user for audit. |
| `appRecordId` | no | Links to an app-data record for audit traceability. |
| `templateSlug` | no | Reserved for Phase 2 platform templates. Pass `null`. |

### Success response `200`

```json
{
  "messageId": "ses-abc123",
  "sentAt": "2026-03-22T14:30:00.000Z",
  "sendingIdentity": "noreply@plannerxchange.ai",
  "status": "queued"
}
```

### Error responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid payload — missing required field or malformed email |
| `403` | App does not have `email.send` permission or installation not found |
| `429` | Rate limit exceeded |
| `451` | Recipient on unsubscribe or suppression list |
| `500` | Platform relay error — retryable |

## Code example

```typescript
async function sendQuestionnaireEmail(
  runtimeContext: ShellRuntimeContext,
  recipientEmail: string,
  recipientName: string,
  questionnaireLink: string
) {
  if (!runtimeContext.authenticatedFetch) {
    throw new Error("PlannerXchange authenticatedFetch is not available.");
  }

  const response = await runtimeContext.authenticatedFetch(
    "/app-email/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: recipientEmail,
        toName: recipientName,
        subject: "Your onboarding questionnaire is ready",
        htmlBody: `<p>Hi ${recipientName},</p>
                   <p>Please complete your onboarding questionnaire:</p>
                   <p><a href="${questionnaireLink}">Open questionnaire</a></p>`,
        clientUserId: runtimeContext.userId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? `Email send failed: ${response.status}`);
  }

  return response.json();
}
```

Do not re-authenticate, store bearer tokens, or manually attach auth headers. The shell-managed fetch owns authenticated PlannerXchange transport.

## Rate limits

| Window | Limit |
|--------|-------|
| Per minute | 20 emails |
| Per hour | 200 emails |
| Per day | 1,000 emails |

Apps that systematically reach day-level limits trigger a review flag.

## Required email hygiene

- Subject and body must identify the sending app or advisor firm — no misleading subject lines
- Provide a reply path (`replyTo` address, support contact, or unsubscribe link)
- For scheduled or recurring emails, include a visible unsubscribe mechanism
- Do not use the `to` address to send PX data to third-party collection endpoints
- PlannerXchange automatically appends the firm's disclosure footer to all outbound HTML emails
- Do not use the email endpoint for bulk marketing or cold outreach

## Audit trail

PlannerXchange records a redacted audit entry for every send attempt including app slug, timestamp, outcome, linked `clientUserId`, linked `appRecordId`, sending identity, and message ID. Recipient email addresses are hashed, not stored in plaintext.
