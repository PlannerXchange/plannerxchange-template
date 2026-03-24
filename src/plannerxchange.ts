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
export type AppPermissionScope =
  | "tenant.read"
  | "user.read"
  | "household.read"
  | "client.summary.read"
  | "client.sensitive.read"
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

export interface ShellRuntimeContext {
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
