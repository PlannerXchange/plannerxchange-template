import type { CSSProperties } from "react";
import type { PlannerXchangeManifest, ShellRuntimeContext } from "./plannerxchange";

export function App({
  context,
  manifest
}: {
  context: ShellRuntimeContext;
  manifest: PlannerXchangeManifest;
}) {
  const shellStyle = {
    "--starter-primary": context.branding.primaryColor,
    "--starter-secondary": context.branding.secondaryColor ?? "#1a1a2e",
    "--starter-font": context.branding.fontColor ?? "#ffffff"
  } as CSSProperties;

  return (
    <main className="starter-shell" style={shellStyle}>
      <section className="starter-hero">
        <div className="starter-hero-header">
          <div className="starter-brand-lockup">
            {context.branding.logoUrl ? (
              <img
                alt={`${context.firmId} logo`}
                className="starter-brand-logo"
                src={context.branding.logoUrl}
              />
            ) : (
              <span className="starter-brand-mark">PX</span>
            )}
            <div>
              <p className="starter-eyebrow">PlannerXchange Starter</p>
              <strong>{manifest.name}</strong>
            </div>
          </div>
          <div className="starter-favicon-preview">
            <span className="starter-label">Favicon</span>
            {context.branding.faviconUrl ? (
              <img alt="Resolved favicon preview" src={context.branding.faviconUrl} />
            ) : (
              <span className="starter-favicon-fallback">PX</span>
            )}
          </div>
        </div>
        <h1>Build once, inherit each firm&apos;s brand at runtime.</h1>
        <p>
          This starter preview intentionally uses the resolved PlannerXchange branding payload so
          student builders can see logo, colors, and legal context flow through the app instead of
          being hardcoded.
        </p>
      </section>

      <section className="starter-grid">
        <article className="starter-card">
          <span className="starter-label">Tenant</span>
          <strong>{context.tenantId}</strong>
        </article>
        <article className="starter-card">
          <span className="starter-label">Firm</span>
          <strong>{context.firmId}</strong>
        </article>
        <article className="starter-card">
          <span className="starter-label">User</span>
          <strong>{context.userId}</strong>
        </article>
        <article className="starter-card">
          <span className="starter-label">Role</span>
          <strong>{context.role}</strong>
        </article>
        <article className="starter-card">
          <span className="starter-label">App</span>
          <strong>{context.appId}</strong>
        </article>
        <article className="starter-card">
          <span className="starter-label">Install</span>
          <strong>{context.appInstallationId}</strong>
        </article>
      </section>

      <section className="starter-layout">
        <article className="starter-panel">
          <h2>Manifest</h2>
          <ul>
            <li>Framework: {manifest.framework}</li>
            <li>Entry point: {manifest.entryPoint}</li>
            <li>Permissions: {manifest.permissions.join(", ")}</li>
            <li>Visibility: {manifest.visibility}</li>
            <li>Portability: {manifest.dataPortabilityMode}</li>
            <li>Environment: {context.publicationEnvironment}</li>
          </ul>
        </article>

        <article className="starter-panel">
          <h2>Resolved platform brand</h2>
          <ul>
            <li>Primary color: {context.branding.primaryColor}</li>
            <li>Secondary color: {context.branding.secondaryColor ?? "PX default"}</li>
            <li>Font color: {context.branding.fontColor ?? "PX default"}</li>
            <li>Support email: {context.branding.supportEmail ?? "Not set"}</li>
            <li>Disclosure: {context.legal.disclosureText}</li>
          </ul>
        </article>

        <article className="starter-panel starter-panel-wide">
          <h2>White-label readiness reminders</h2>
          <ul>
            <li>Request `branding.read` if the app renders its own branded chrome.</li>
            <li>Use responsive logo sizing instead of assuming one exact width or aspect ratio.</li>
            <li>Fall back cleanly when logo or favicon is missing.</li>
            <li>Prefer PlannerXchange branding and legal context over hardcoded assets or text.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
