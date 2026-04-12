/**
 * PX Gateway — mock/live switch for PlannerXchange API calls.
 *
 * In mock mode (VITE_PX_MODE !== "live"), calls return synthetic data from
 * local stubs so the app works fully offline.
 *
 * In live mode, calls route through the real PX API using the idToken and
 * appInstallationId from ShellRuntimeContext.
 *
 * Usage:
 *   import { createPxGateway } from "./lib/px-gateway";
 *   const gw = createPxGateway(runtimeContext);
 *   const households = await gw.getHouseholds();
 */

import { isShellHosted, type ShellRuntimeContext } from "../plannerxchange";

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
  data: T;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Mock data — used when VITE_PX_MODE is not "live"
// ---------------------------------------------------------------------------

const MOCK_HOUSEHOLDS: HouseholdSummary[] = [
  { householdId: "hh-mock-001", name: "Smith Household" },
  { householdId: "hh-mock-002", name: "Johnson Household" },
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
  getAppData(recordType: string): Promise<AppDataRecord[]>;
  putAppData(record: AppDataRecord): Promise<void>;
  deleteAppData(recordId: string): Promise<void>;
}

export function createPxGateway(ctx: ShellRuntimeContext): PxGateway {
  // Detect live mode at runtime from the context itself.
  // When running locally with `vite dev`, main.tsx injects the synthetic
  // mock context. When running inside the PlannerXchange shell (dev or prod),
  // the context has a real installation ID and JWT.
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

    async getAppData(recordType) {
      return [...mockAppDataStore.values()].filter(
        (r) => r.recordType === recordType
      );
    },

    async putAppData(record) {
      mockAppDataStore.set(record.recordId, {
        ...record,
        updatedAt: new Date().toISOString(),
      });
    },

    async deleteAppData(recordId) {
      mockAppDataStore.delete(recordId);
    },
  };
}

// ---------------------------------------------------------------------------
// Live implementation — calls the real PX API
// ---------------------------------------------------------------------------

function liveGateway(ctx: ShellRuntimeContext): PxGateway {
  // Use the shell-injected API base URL instead of hardcoding.
  // This ensures the app calls the correct API for dev/staging/prod.
  const base = ctx.apiBaseUrl || import.meta.env.VITE_PX_API_BASE || "https://api.plannerxchange.ai";

  async function pxFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.idToken}`,
        "x-plannerxchange-app-installation-id":
          ctx.appInstallationId ?? "",
        ...(init?.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      throw new Error(`PX API ${path}: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    isLive: true,

    async getHouseholds() {
      return pxFetch<HouseholdSummary[]>("/households");
    },

    async getAppData(recordType) {
      return pxFetch<AppDataRecord[]>(
        `/app-data?recordType=${encodeURIComponent(recordType)}`
      );
    },

    async putAppData(record) {
      await pxFetch<void>("/app-data", {
        method: "PUT",
        body: JSON.stringify(record),
      });
    },

    async deleteAppData(recordId) {
      await pxFetch<void>(`/app-data/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      });
    },
  };
}
