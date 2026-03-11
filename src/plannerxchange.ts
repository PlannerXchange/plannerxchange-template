export type UserType = "firm_user" | "client_user";
export type FrontendFramework = "react" | "vue" | "nextjs" | "html-js";
export type AppVisibility =
  | "private"
  | "shared_with_specific_users"
  | "marketplace_listed";
export type AppPermissionScope =
  | "tenant.read"
  | "user.read"
  | "client.read"
  | "client.write"
  | "notes.write";

export interface BrandingProfile {
  tenantId: string;
  enterpriseId?: string;
  firmId?: string;
  primaryColor: string;
  secondaryColor?: string;
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
  framework: FrontendFramework;
  entryPoint: string;
  permissions: AppPermissionScope[];
  configSchemaVersion: number;
  visibility: AppVisibility;
  categories: string[];
}

export interface ShellRuntimeContext {
  tenantId: string;
  enterpriseId: string;
  firmId: string;
  userId: string;
  userType: UserType;
  role: string;
  branding: BrandingProfile;
  legal: LegalProfile;
}

export interface PlannerXchangePluginModule {
  manifest: PlannerXchangeManifest;
  mount: (context: ShellRuntimeContext) => Promise<void> | void;
}
