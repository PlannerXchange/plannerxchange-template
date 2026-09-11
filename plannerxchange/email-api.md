# PlannerXchange Outbound Email API

Status: current text-email contract clarified 2026-09-08. PDF attachments,
PX-hosted secure report links, recipient verification, and the proposed report
dialog are **planned, not available through this contract yet**. A plan is not
a callable API. Refresh the current context pack, SDK/shim and target environment
before integration; do not describe a planned entry as released.


## Repairing legacy request fields

A helper that serializes `{ to, subject, html, text }` verbatim does not satisfy
this endpoint. Keep the supported transport and map its wire fields:

```ts
const body = {
  to: input.to,
  subject: input.subject,
  htmlBody: input.html,
  ...(input.text === undefined ? {} : { textBody: input.text }),
};
const response = await runtimeContext.authenticatedFetch!(
  `${runtimeContext.apiBaseUrl}/app-email/send`,
  { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) },
);
```

This excerpt shows the field mapping only. Before calling it, check installed
host availability, `email.send`, public Demo mode and explicit recipient
confirmation. Check `response.ok` before consuming JSON; the result is
`{ messageId, sentAt, sendingIdentity, status: "queued" }`. Label that outcome
“Accepted for sending,” not confirmed delivery. Preserve results on failure.
A timeout can follow acceptance; do not retry automatically.
`app_email_send_failed` also means the send could not be confirmed, not proof that
nothing was sent.

An otherwise authorized call without `htmlBody` would receive
`400 missing_html_body`. That is a predicted contract result unless an observed
response proves it. Renaming the helper type without correcting serialization
and callers does not fix the request. Capture the safe API error code/request ID
for support; never copy recipient addresses, subjects, report contents or tokens
into logs or review feedback.

Review may report `email-request-contract-invalid` for a proven local
request-shape violation, `email-permission-missing` for the candidate declaration,
or recommended `email-request-contract-unresolved` when values or cross-file
activation need further evidence. `email-contract-evidence-incomplete` is
informational analyzer coverage, not a code violation. None of these checks
proves PDF delivery, recipient receipt, or installed-release readiness.

## Core rule

Keep the app's legitimate workflow trigger, recipient experience and report
generation. Use PlannerXchange's governed transport for supported transactional
email. Apps must not hold SMTP/provider credentials, create email backends,
upload reports to third-party services, or implement recipient authentication.

Read this guide before adding or removing an email feature. It is available in
this public repository; access to the private platform repo is not required.

## Current capability and limits

| Capability | Current status |
| --- | --- |
| One HTML/text workflow message | `POST /app-email/send` with `email.send` |
| Authentication and installation context | Shell-owned `authenticatedFetch` |
| Platform sender, reply-to default, disclosure footer | Implemented |
| PDF attachment request field | Not supported |
| Private report upload or secure recipient link | Not supported by this endpoint |
| PX report-send dialog or recipient code verification | Planned; no current hook to invent |
| Scheduled/background jobs, bulk mail, marketing | Not supported for ordinary shell apps |
| Linked Gmail/Outlook or firm mailbox OAuth | Future direction; not current sending behavior |
| Application idempotency and documented per-app quotas | Hardening pending; do not assume enforcement |
| Delivery/bounce status API | Not part of the current builder contract |

A working email transport does not make a link accessible to an external
recipient. An app route or app-data ID does not create a public questionnaire,
client account, report grant, or secure PDF URL.

## Manifest and transport

Add `"email.send"` to the manifest's existing `permissions` array only when
the app uses transactional email. Do not invent `email`, `email.enabled`,
`attachments`, or `capabilities` manifest fields.

```json
{
  "permissions": ["tenant.read", "user.read", "email.send"]
}
```

Call `POST /app-email/send` through `ShellRuntimeContext.authenticatedFetch`.
The shell attaches user authentication and installation/runtime context.
Do not read/store tokens, add auth headers, use frontend provider keys,
hardcode an API base URL, or create `/api/send-email` in the app.

The actor must have an active authorized installation in the current firm.
The server checks the existing permission and access policy. A successful
local mock or a manifest permission alone does not prove deployed availability.

## Exact current request

```json
{
  "to": "recipient@example.test",
  "toName": "Avery Example",
  "subject": "Your workflow is complete",
  "htmlBody": "<p>Your requested workflow is complete.</p>",
  "textBody": "Your requested workflow is complete."
}
```

The address above is synthetic documentation data, not a real delivery target.

| Field | Required | Current contract |
| --- | --- | --- |
| `to` | Yes | One recipient email address |
| `toName` | No | Recipient display name |
| `subject` | Yes | Nonempty plain text, at most 200 characters |
| `htmlBody` | Yes | Nonempty HTML; PX appends its disclosure footer |
| `textBody` | No | Text alternative; otherwise generated from HTML |
| `replyTo` | No | Authorized reply address; defaults to the active advisor's email |
| `fromLabel` | No | Honest app/firm display label; defaults to the app name |
| `clientUserId` | No | Actual existing PX client-user reference, if applicable |
| `appRecordId` | No | Actual server-issued app-data record reference, if applicable |

No other request fields are currently supported. Do not send `templateSlug`,
`unsubscribeToken`, `includeUnsubscribeFooter`, `attachments`,
`documentId`, `deliveryMode`, or an invented idempotency field. Do not rely
on an older handler ignoring an unknown field as evidence that it works.

A recipient is not automatically a PX client user. Never set `clientUserId`
to `runtimeContext.userId` merely because the advisor triggered the send, and
never substitute a canonical client ID or email address for a client-user ID.
Omit optional references when they do not exist. Sending once does not require
creating a new canonical client or a PX account.

When deriving the address from canonical client detail, use the authorized
`canonical.client.sensitive.read` path. Summary-safe client records do not
contain an implied usable email address. A one-off recipient field is delivery
input, not a replacement for a canonical Client selector.

## Sender, content, and data handling

PX currently uses its configured platform sender, normally
`noreply@plannerxchange.ai`. Do not claim it sends from a connected advisor
mailbox or that the message appears in that mailbox's Sent folder.
Firm-specific sending identities and linked Gmail/Outlook remain future work.

Prefer default sender/reply-to behavior. An override must identify the actual
authorized advisor/firm; never impersonate another sender. Escape dynamic
HTML/attributes, keep headers plain and free of control characters, and do not
put client names, questionnaire answers, account data, or report contents into
the subject. Use a plain-text alternative. Do not embed PDF/base64 data in HTML.

Never persist recipient data or report bytes in browser storage, analytics,
logs, source fixtures or an app-owned backend. Any app-data persistence must
follow the separate approved data contract; a generic app payload is not
permission to store a plaintext recipient directory.

Only send a transactional message tied to an explicit user workflow.
Do not use this API for cold outreach, campaigns, newsletters, autonomous
retry loops, or platform identity invitations/password/verification flows.

## Response, UI and retry behavior

The current success response is HTTP `200`:

```json
{
  "messageId": "provider-message-id",
  "sentAt": "2026-09-08T12:00:00.000Z",
  "sendingIdentity": "noreply@plannerxchange.ai",
  "status": "queued"
}
```

Here `queued` means the provider accepted the send request. It is not
confirmation that the recipient received or read the message.

| Observation | Builder UI / action |
| --- | --- |
| `200` with current success shape | Show accepted/submitted status, not Delivered or Read |
| Missing/invalid recipient, subject or HTML (`400`) | Show a friendly correction; preserve completed work |
| Missing permission, disabled/inactive access (`403`) | Explain unavailability; inspect the manifest/current review |
| Missing installation (`404`), missing context, payment/auth failure | Use shell access recovery; do not implement login in the app |
| Network timeout or server failure | Sending may be uncertain; do not blindly retry |
| Public Demo / local synthetic mock | Simulate and clearly indicate that no message was sent |

Block repeat clicks while the request is pending. The current endpoint does
not provide durable idempotency, so an automatic retry can duplicate a message.
Do not catch a failed send and then display success. Preserve the questionnaire
and local PDF download. Show safe user-facing errors, not raw API/provider text.

Older docs advertised `429` application quotas and `451` suppression responses.
Those outcomes and the 20/min, 200/hour, 1,000/day application limits are target
hardening, not a current guarantee. SES/environment controls may independently
reject delivery. Do not create a builder-side mass-mail queue as a workaround.

## Planned report delivery - do not implement a guessed API

The intended released flow is:

1. Complete the questionnaire and generate the PDF in the app.
2. Open a host-provided PX report-send dialog with the PDF.
3. Confirm a one-off recipient or select an authorized canonical contact in PX.
4. Receive an accepted delivery ID; PX handles private storage, transport and status.
5. Recipient verifies mailbox access and views/downloads one expiring report.

The exact hook, input/result types, limits, cancellation, availability and
status/retry rules will be published with the implementation. The permission
remains `email.send`; do not invent a new manifest flag or shim implementation.

The platform now contains internal `AppReportDocumentPrepareInput`,
`AppReportDocumentUploadInput` and `AppReportDocumentSummary` foundation types.
They do not expose an upload endpoint or a host capability. Do not pass these
objects to `/app-email/send`, invent a report route, or implement a shim hook.
Continue to preserve PDF generation/download until the released host contract
and target environment explicitly provide report delivery. Platform-owned
encrypted-storage code does not grant apps upload, bucket or decrypt access;
its internal protected-data fields are not manifest permissions or app-data schemas.


Until the target environment and released SDK/shim support the flow, retain
report generation/download and an honest unavailable state for report email.
Do not substitute a public object URL, standalone app route, external provider,
mailto attachment trick, backend worker, or custom code-verification screen.

## Builder-agent implementation and remediation checklist

- [ ] Read this guide, the current shim/SDK, target-environment availability,
  and latest review export. Distinguish current, planned and processing-failed.
- [ ] Identify the actual user action, intended recipient and report/message.
  Preserve the requested business workflow and completed questionnaire.
- [ ] For current text mail, use the exact fields above and `email.send`.
  For report delivery, wait for its released contract; do not guess methods.
- [ ] Remove reachable app-owned transport/credentials while keeping legitimate
  presentation, PDF generation and recipient intent. Do not disable a security
  rule or use a direct provider workaround to obtain a passing review.
- [ ] Use existing authorized canonical reads when selecting a client; label
  one-off delivery input clearly and do not manufacture record/user IDs.
- [ ] Branch on public Demo before protected initialization. Use synthetic
  recipients/results and make zero real sends/uploads/protected requests.
- [ ] Handle cancel, pending, accepted, failure and uncertain outcomes honestly.
  Keep download available; do not automatically resend the legacy endpoint.
- [ ] Rebuild only with the applicable resource approval, and include fresh
  committed `distRoot`/provenance in an authorized review commit.
- [ ] Obtain feedback for that exact commit and selected outcome through the
  existing read-only PX CLI loop; fix proven app findings, not platform outages.
- [ ] Record acceptance evidence below before calling the email feature complete.

If review says to remove email, inspect its exact file/line, sink and reason.
A provider/credential finding calls for replacing transport, not deleting the
user's completion workflow. If the needed PX capability is unavailable or the
analyzer failed, preserve a safe unavailable state and report the platform
dependency. Do not rewrite the app spec to erase the requested feature.

## Builder acceptance evidence

| Check | Evidence required |
| --- | --- |
| Workflow retained | Questionnaire completion still reaches the intended report/download/send experience |
| Correct integration | Exact current permission, request/hook and source call site; no provider secrets/backend |
| Recipient correctness | Confirmed intended recipient; no forced hidden copy, fake IDs or wrong-firm record |
| Repeat/error handling | Double-click does not create concurrent calls; failure/timeout preserves work and never displays false success |
| Demo isolation | Synthetic branch performs zero real sends, uploads and protected requests |
| Artifact parity | Reviewed SHA and committed build contain the tested completion and error paths |
| Real delivery | Only an explicitly authorized test mailbox; provider acceptance separated from actual received-message evidence |
| Future secure report | Once released: exact PDF, recipient without PX account, expired/revoked/forwarded-link denial and accurate status |

These are app acceptance checks, not a claim that the platform's new report
service already passed its acceptance matrix. Public-template docs, platform
deployment, app review/publication and production acceptance are separate gates.
