import type { ShellRuntimeContext } from "./plannerxchange";
import mockFirmFaviconUrl from "./assets/mock-firm-favicon.svg";
import mockFirmLogoUrl from "./assets/mock-firm-logo.svg";

export const mockRuntimeContext: ShellRuntimeContext = {
  tenantId: "plannerxchange-marketplace",
  enterpriseId: "plannerxchange-marketplace-enterprise",
  firmId: "friendly-advisor-firm",
  userId: "advisor-user-001",
  userType: "firm_user",
  role: "advisor_user",
  appId: "starter-app",
  appInstallationId: "starter-installation",
  publicationEnvironment: "dev",
  visibility: "private",
  dataPortabilityMode: "plannerxchange_portable",
  permissions: ["tenant.read", "user.read", "branding.read", "legal.read"],
  branding: {
    tenantId: "plannerxchange-marketplace",
    enterpriseId: "plannerxchange-marketplace-enterprise",
    firmId: "friendly-advisor-firm",
    primaryColor: "#e8613c",
    secondaryColor: "#1a1a2e",
    fontColor: "#ffffff",
    logoUrl: mockFirmLogoUrl,
    faviconUrl: mockFirmFaviconUrl,
    supportEmail: "support@plannerxchange.ai"
  },
  legal: {
    tenantId: "plannerxchange-marketplace",
    enterpriseId: "plannerxchange-marketplace-enterprise",
    firmId: "friendly-advisor-firm",
    disclosureText: "PlannerXchange starter runtime preview. Use platform-owned auth in production."
  }
};
