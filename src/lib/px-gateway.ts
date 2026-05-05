/**
 * PX Gateway — mock/live switch for PlannerXchange API calls.
 *
 * In local mock mode, calls return synthetic data from local stubs so the app
 * works fully offline.
 *
 * In live mode, calls route through the real PX API using the shell-managed
 * authenticatedFetch from ShellRuntimeContext.
 *
 * Usage:
 *   import { createPxGateway } from "./lib/px-gateway";
 *   const gw = createPxGateway(runtimeContext);
 *   const households = await gw.getHouseholds();
 */

import {
  isShellHosted,
  type PlannerXchangeApiRequestInit,
  type ShellRuntimeContext
} from "../plannerxchange";

// ---------------------------------------------------------------------------
// Types — extend these as the app grows
// ---------------------------------------------------------------------------

/** Minimal household shape for demo purposes. Replace with your app types. */
export interface HouseholdSummary {
  householdId: string;
  name: string;
}

/** Generic app-data record envelope. */
export interface AppDataRecord<T = unknown> {
  recordId: string;
  recordType: string;
  title?: string;
  status?: "draft" | "final" | "archived";
  schemaVersion: number;
  clientUserId?: string;
  householdId?: string;
  accountId?: string;
  sourceRefs?: AppDataSourceRef[];
  payload: T;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppDataSourceRef {
  sourceType: string;
  sourceId: string;
  sourceSystem?: string;
  asOf?: string;
}

export interface AppDataCreateInput<T = unknown> {
  recordType: string;
  title?: string;
  status?: "draft" | "final" | "archived";
  schemaVersion?: number;
  clientUserId?: string;
  householdId?: string;
  accountId?: string;
  sourceRefs?: AppDataSourceRef[];
  payload: T;
}

export type AppDataUpdateInput<T = unknown> = Partial<
  Pick<AppDataCreateInput<T>, "title" | "status" | "clientUserId" | "householdId" | "accountId" | "sourceRefs" | "payload">
>;

interface AppDataListResponse<T = unknown> {
  items: AppDataRecord<T>[];
}

// ---------------------------------------------------------------------------
// Mock data — used when the app is not running inside the PlannerXchange shell
// ---------------------------------------------------------------------------

const MOCK_HOUSEHOLDS: HouseholdSummary[] = [
  { householdId: "hh-mock-001", name: "Example Household A" },
  { householdId: "hh-mock-002", name: "Example Household B" },
];

const mockAppDataStore = new Map<string, AppDataRecord>();

// ---------------------------------------------------------------------------
// Gateway factory
// ---------------------------------------------------------------------------

export interface PxGateway {
  /** True when the gateway is routing calls to the real PX API. */
  isLive: boolean;

  // Canonical reads
  getHouseholds(): Promise<HouseholdSummary[]>;

  // App-data CRUD
  getAppData<T = unknown>(recordType: string): Promise<AppDataRecord<T>[]>;
  createAppData<T = unknown>(input: AppDataCreateInput<T>): Promise<AppDataRecord<T>>;
  updateAppData<T = unknown>(recordId: string, input: AppDataUpdateInput<T>): Promise<AppDataRecord<T>>;
}

export function createPxGateway(ctx: ShellRuntimeContext): PxGateway {
  // Detect live mode at runtime from the context itself.
  // When running locally with `vite dev`, main.tsx injects the synthetic
  // mock context. When running inside the PlannerXchange shell (dev or prod),
  // the context has a real installation ID and shell-managed API fetch.
  //
  // Do NOT use `publicationEnvironment` or build-time env vars for this check.
  // `publicationEnvironment: "dev"` means the real PlannerXchange dev tier,
  // not "offline / mock mode".
  if (!isShellHosted(ctx)) {
    return mockGateway();
  }
  return liveGateway(ctx);
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function mockGateway(): PxGateway {
  return {
    isLive: false,

    async getHouseholds() {
      return MOCK_HOUSEHOLDS;
    },

    async getAppData<T = unknown>(recordType: string): Promise<AppDataRecord<T>[]> {
      return [...mockAppDataStore.values()].filter(
        (r) => r.recordType === recordType
      ) as AppDataRecord<T>[];
    },

    async createAppData<T = unknown>(input: AppDataCreateInput<T>): Promise<AppDataRecord<T>> {
      const recordId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `appdata-mock-${Date.now()}`;
      const record: AppDataRecord<T> = {
        recordId,
        recordType: input.recordType,
        title: input.title,
        status: input.status ?? "draft",
        schemaVersion: input.schemaVersion ?? 1,
        clientUserId: input.clientUserId,
        householdId: input.householdId,
        accountId: input.accountId,
        sourceRefs: input.sourceRefs ?? [],
        payload: input.payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockAppDataStore.set(record.recordId, {
        ...record,
        updatedAt: new Date().toISOString(),
      });
      return record;
    },

    async updateAppData<T = unknown>(
      recordId: string,
      input: AppDataUpdateInput<T>
    ): Promise<AppDataRecord<T>> {
      const existing = mockAppDataStore.get(recordId) as AppDataRecord<T> | undefined;
      if (!existing) {
        throw new Error(`Mock app-data record not found: ${recordId}`);
      }
      const updated: AppDataRecord<T> = {
        ...existing,
        ...input,
        payload: input.payload ?? existing.payload,
        updatedAt: new Date().toISOString(),
      };
      mockAppDataStore.set(recordId, updated);
      return updated;
    },
  };
}

// ---------------------------------------------------------------------------
// Live implementation — calls the real PX API
// ---------------------------------------------------------------------------

function liveGateway(ctx: ShellRuntimeContext): PxGateway {
  // Use the shell-injected API base URL instead of hardcoding.
  // This ensures the app calls the correct API for dev/staging/prod.
  const authenticatedFetch = ctx.authenticatedFetch;

  if (!authenticatedFetch) {
    throw new Error("PlannerXchange authenticatedFetch is not available in this runtime context.");
  }
  const pxFetchImpl = authenticatedFetch;

  async function pxFetch<T>(path: string, init?: PlannerXchangeApiRequestInit): Promise<T> {
    const res = await pxFetchImpl(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`PX API ${path}: ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    isLive: true,

    async getHouseholds() {
      return pxFetch<HouseholdSummary[]>("/households");
    },

    async getAppData<T = unknown>(recordType: string): Promise<AppDataRecord<T>[]> {
      const payload = await pxFetch<AppDataListResponse<T>>(
        `/app-data?recordType=${encodeURIComponent(recordType)}`
      );
      return payload.items ?? [];
    },

    async createAppData<T = unknown>(input: AppDataCreateInput<T>): Promise<AppDataRecord<T>> {
      return pxFetch<AppDataRecord<T>>("/app-data", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          schemaVersion: input.schemaVersion ?? 1,
        }),
      });
    },

    async updateAppData<T = unknown>(
      recordId: string,
      input: AppDataUpdateInput<T>
    ): Promise<AppDataRecord<T>> {
      return pxFetch<AppDataRecord<T>>(`/app-data/${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
  };
}
