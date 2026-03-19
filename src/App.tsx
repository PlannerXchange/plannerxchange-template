import type { PlannerXchangeManifest, ShellRuntimeContext } from "./plannerxchange";

export function App({
  context,
  manifest
}: {
  context: ShellRuntimeContext;
  manifest: PlannerXchangeManifest;
}) {
  return (
    <main className="starter-shell">
      <section className="starter-hero">
        <p className="starter-eyebrow">PlannerXchange Starter</p>
        <h1>{manifest.name}</h1>
        <p>
          This starter app mounts inside a PlannerXchange-style runtime context. It does not own
          auth, tenant resolution, or top-level layout.
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
          <h2>Platform-owned context</h2>
          <ul>
            <li>Brand color: {context.branding.primaryColor}</li>
            <li>Support email: {context.branding.supportEmail ?? "Not set"}</li>
            <li>Disclosure: {context.legal.disclosureText}</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
