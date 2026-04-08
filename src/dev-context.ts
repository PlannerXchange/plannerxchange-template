import type { ShellRuntimeContext } from "./plannerxchange";

export const mockRuntimeContext: ShellRuntimeContext = {
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
