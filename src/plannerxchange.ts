export type UserType = "firm_user" | "client_user";
export type KnownFrontendFramework = "react" | "vue" | "nextjs" | "html-js";
export type FrontendFramework = KnownFrontendFramework | (string & {});
export type AppVisibility =
  | "private"
  | "shared_with_specific_users"
  | "marketplace_listed";
export type AppDataPortabilityMode =
  | "plannerxchange_portable"
  | "app_managed_nonportable";
// Legacy summary-safe client-user routes and current canonical entity routes
// use different scope families. Student apps should prefer the `canonical.*`
// scopes when targeting `/canonical/*` APIs.
export type AppPermissionScope =
  | "tenant.read"
  | "user.read"
  | "household.read"
  | "client.summary.read"
  | "client.sensitive.read"
  | "canonical.household.read"
  | "canonical.client.summary.read"
  | "canonical.client.sensitive.read"
  | "canonical.account.read"
  | "canonical.position.read"
  | "canonical.transaction.read"
  | "canonical.cost_basis.read"
  | "canonical.security.read"
  | "canonical.model.read"
  | "canonical.sleeve.read"
  | "account.read"
  | "position.read"
  | "transaction.read"
  | "cost_basis.read"
  | "security.read"
  | "model.read"
  | "app_access.read"
  | "feature_entitlements.read"
  | "branding.read"
  | "legal.read"
  | "app_data.read"
  | "app_data.write"
  | "email.send";

export interface BrandingProfile {
  tenantId: string;
  enterpriseId?: string;
  firmId?: string;
  primaryColor: string;
  secondaryColor?: string;
  fontColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  supportEmail?: string;
}

export interface LegalProfile {
  tenantId: string;
  enterpriseId?: string;
  firmId?: string;
  appId?: string;
  disclosureText: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
}

export interface PlannerXchangeManifest {
  slug: string;
  name: string;
  version: string;
  summary?: string;
  description?: string;
  priceLabel?: string;
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  framework: FrontendFramework;
  entryPoint: string;
  permissions: AppPermissionScope[];
  configSchemaVersion: number;
  visibility: AppVisibility;
  dataPortabilityMode: AppDataPortabilityMode;
  categories: string[];
}

export interface PlannerXchangeApiRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface PlannerXchangeFetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text?: () => Promise<string>;
}

export type PlannerXchangeFetchLike = (
  url: string,
  init?: PlannerXchangeApiRequestInit
) => Promise<PlannerXchangeFetchResponseLike>;

export interface ShellRuntimeContext {
  runtimeMode?: "authenticated" | "public_demo";
  isDemoMode?: boolean;
  demoDataMode?: "synthetic";
  /**
   * Deprecated for hosted apps. The PlannerXchange shell does not expose raw
   * user bearer tokens to installed app code. Use `authenticatedFetch` for
   * PlannerXchange API calls. Local mock contexts may still include a synthetic
   * placeholder string.
   */
  idToken: string;
  /**
   * Shell-managed fetch for authenticated PlannerXchange API calls. The shell
   * attaches user auth and `x-plannerxchange-app-installation-id`, and rejects
   * shell-only endpoints such as custodian integrations.
   */
  authenticatedFetch?: PlannerXchangeFetchLike;
  /**
   * The base URL for PlannerXchange API calls (e.g. "https://api.plannerxchange.ai").
   * Apps should use this instead of hardcoding API URLs so they work across
   * dev/staging/prod environments.
   */
  apiBaseUrl: string;
  tenantId: string;
  enterpriseId: string;
  firmId: string;
  userId: string;
  userType: UserType;
  role: string;
  appId: string;
  appInstallationId: string;
  publicationEnvironment: "dev" | "prod";
  visibility: AppVisibility;
  dataPortabilityMode: AppDataPortabilityMode;
  permissions: AppPermissionScope[];
  branding: BrandingProfile;
  legal: LegalProfile;
  /**
   * The shell-scoped path prefix for this app, e.g. "/apps/my-tool".
   * Use this as the `basename` for your client-side router so in-app
   * navigation stays within the shell-owned URL space.
   */
  appBasename: string;
  /**
   * The current in-app path relative to `appBasename`, e.g. "/households/abc123".
   * Initialize your router at this path so deep links render the correct view.
   * Defaults to "/" when the user navigates to the app root.
   */
  initialPath: string;
}

export interface PlannerXchangePluginModule {
  manifest: PlannerXchangeManifest;
  mount: (context: ShellRuntimeContext) => Promise<void> | void;
}

/**
 * Returns true when the context was provided by the real PlannerXchange shell
 * (dev or prod), as opposed to the local mock context from dev-context.ts.
 *
 * Use this to switch between mock/offline data and live PlannerXchange API calls.
 * Do NOT use `publicationEnvironment` for this purpose — `"dev"` is a real
 * shell environment, not a synonym for "offline / mock mode".
 */
export function isShellHosted(ctx: ShellRuntimeContext): boolean {
  return (
    ctx.appInstallationId !== "synthetic-installation-context" &&
    typeof ctx.authenticatedFetch === "function"
  );
}
