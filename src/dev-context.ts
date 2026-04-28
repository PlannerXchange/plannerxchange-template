import type { ShellRuntimeContext } from "./plannerxchange";

export const mockRuntimeContext: ShellRuntimeContext = {
  // In local dev mode, this token is a placeholder. Hosted apps should use
  // authenticatedFetch instead of reading idToken directly.
  idToken: "synthetic-dev-token",
  // In local dev mode, this defaults to the dev API. When running inside the
  // PlannerXchange shell, the shell's environment-specific API URL is injected.
  apiBaseUrl: import.meta.env.VITE_PX_API_BASE ?? "https://5o4j1sxhui.execute-api.us-east-2.amazonaws.com",
  tenantId: "synthetic-marketplace-tenant",
  enterpriseId: "synthetic-enterprise",
  firmId: "synthetic-demo-firm",
  userId: "synthetic-advisor-user-001",
  userType: "firm_user",
  role: "advisor_user",
  appId: "starter-app",
  appInstallationId: "synthetic-installation-context",
  publicationEnvironment: "dev",
  appBasename: "/apps/starter-app",
  initialPath: "/",
  visibility: "private",
  dataPortabilityMode: "app_managed_nonportable",
  permissions: ["tenant.read", "user.read"],
  branding: {
    tenantId: "synthetic-marketplace-tenant",
    enterpriseId: "synthetic-enterprise",
    firmId: "synthetic-demo-firm",
    primaryColor: "#456173",
    secondaryColor: "#d9e1e8",
    fontColor: "#16212b",
    supportEmail: "demo-support@example.test"
  },
  legal: {
    tenantId: "synthetic-marketplace-tenant",
    enterpriseId: "synthetic-enterprise",
    firmId: "synthetic-demo-firm",
    disclosureText:
      "Synthetic PlannerXchange starter preview. This local runtime does not represent a real installed app."
  }
};
