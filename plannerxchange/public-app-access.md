# Public app links and embeds

Status: calculator implementation updated 2026-10-08; coordinated dev deployment
and browser acceptance remain pending. Explicit pilot enrollment is required.
Anonymous questionnaire submission and results email are not released.

The intended capability gives each participating firm a stable, branded public
link that opens directly or embeds in an iframe. The same reviewed app can serve
different firms with separate settings, branding and visitor-data ownership.
Public visitors receive no advisor identity, canonical records or general
app-data permissions. The link itself is public, not a secret access credential.

Do not invent `publicAccess`, `publicRuntime`, `iframe`, new permission scopes,
SDK methods or CLI goals. For an enrolled calculator pilot, declare only
`publicApp: { schemaVersion: 1, embedding: true, resultsEmail: false }` and export
`mountPublic({ container, context })` from the existing plugin entry alongside
its authenticated mount. Use the separate PublicAppMount/PublicAppRuntimeContext
types; do not cast a public context to ShellRuntimeContext. The published entry
must be a self-contained ESM bundle; split imports are unsupported in the pilot.
Use context.branding and context.legal for app-authored presentation. There is no
member identity, authenticatedFetch, canonical bridge or visitor credential in
this context. Keep answers in memory: no contacts, storage, network requests,
forms submission, external fonts, frames, popups or top navigation.

A firm admin enables access from Your Apps > Public access and copies its stable
URL/embed. Every ancestor origin must be in the HTTPS allowlist; blank means
direct opening only. Changes follow the installed release and preserve the link.
Public consent must match its authority; the dev operator also accepts each exact
source/artifact before activation. Pause denies new visits and removes an open
calculator on the next host check; rotation permanently retires the old link.
Do not bypass availability using app-owned backends or install tokens.

Public Demo remains synthetic-only: no real contact intake, persistence or email.
Public landing-page CTA rules also remain unchanged. A future public tool is a
separate runtime with reviewed capabilities and firm activation.

Email is optional and separately declared with the existing `email.send` scope.
That scope alone does not make the authenticated email endpoint anonymously
callable. Builder-authored message HTML must consume the applicable private-label
branding and legal settings throughout its body. Verify the logo, colors, firm
identity and disclosures under two firms; changing only a sender label or footer
is insufficient. Preserve the builder's reviewed layout and use the effective
firm branding rather than hardcoding the builder's firm identity.

Full source/artifact review, private-label evidence, exact-release operator
acceptance and firm opt-in are all required. Local compilation is not deployment
or browser acceptance. Do not use a public link or visitor credential as an advisor token,
call first-party firm-settings routes from an app, or infer anonymous email
authority from `email.send`.

For current authenticated email use, follow [email-api.md](email-api.md).
For current branding, follow [branding-and-legal-api.md](branding-and-legal-api.md).
Lead retention/client conversion, verified private links, visitor paywalls and
public AI remain later capabilities. No new fee or operating allowance is
established by this availability note.
