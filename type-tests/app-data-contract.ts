import type { AppDataCreateInput, AppDataUpdateInput } from "../src/lib/px-gateway";

type State = { ready: boolean };

const create: AppDataCreateInput<State> = {
  recordType: "workspace_state",
  status: "draft",
  schemaVersion: 1,
  payload: { ready: true }
};
const update: AppDataUpdateInput<State> = { payload: { ready: false } };

// @ts-expect-error create status is required
const missingStatus: AppDataCreateInput<State> = { recordType: "state", schemaVersion: 1, payload: { ready: true } };
// @ts-expect-error create schemaVersion is required
const missingSchema: AppDataCreateInput<State> = { recordType: "state", status: "draft", payload: { ready: true } };
// @ts-expect-error payload must be an object
const primitivePayload: AppDataCreateInput<string> = { recordType: "state", status: "draft", schemaVersion: 1, payload: "legacy" };
// @ts-expect-error an update cannot be empty
const emptyUpdate: AppDataUpdateInput<State> = {};
// @ts-expect-error associations cannot be patched
const associationUpdate: AppDataUpdateInput<State> = { clientUserId: "client-1" };

void [create, update];
