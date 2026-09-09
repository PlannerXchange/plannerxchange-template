import type { ShellRuntimeContext, CanonicalRecordFormRequest, CanonicalRecordFormResult } from "../src/plannerxchange";
declare const context: ShellRuntimeContext;
const client: CanonicalRecordFormRequest = { operation: "create", entity: "client", householdId: "existing" };
const household: CanonicalRecordFormRequest = { operation: "create", entity: "household" };
// @ts-expect-error accounts are excluded from the initial standard form
const account: CanonicalRecordFormRequest = { operation: "create", entity: "account" };
// @ts-expect-error edit is not implemented by the create-first hook
const edit: CanonicalRecordFormRequest = { operation: "update", entity: "client" };
// @ts-expect-error PII belongs to the PX form, not its launch request
const pii: CanonicalRecordFormRequest = { operation: "create", entity: "client", firstName: "Example" };
if (context.openCanonicalRecordForm) {
  const result: Promise<CanonicalRecordFormResult> = context.openCanonicalRecordForm(client);
  void result;
}
void household; void account; void edit; void pii;
