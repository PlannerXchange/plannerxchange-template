import type { ShellRuntimeContext } from "./plannerxchange";

export const mockRuntimeContext: ShellRuntimeContext = {
  tenantId: "plannerxchange-marketplace",
  enterpriseId: "plannerxchange-marketplace-enterprise",
  firmId: "friendly-advisor-firm",
  userId: "advisor-user-001",
  userType: "firm_user",
  role: "advisor_user",
  branding: {
    tenantId: "plannerxchange-marketplace",
    enterpriseId: "plannerxchange-marketplace-enterprise",
    firmId: "friendly-advisor-firm",
    primaryColor: "#102033",
    secondaryColor: "#DDA94B",
    supportEmail: "support@plannerxchange.ai"
  },
  legal: {
    tenantId: "plannerxchange-marketplace",
    enterpriseId: "plannerxchange-marketplace-enterprise",
    firmId: "friendly-advisor-firm",
    disclosureText: "PlannerXchange starter runtime preview. Use platform-owned auth in production."
  }
};
