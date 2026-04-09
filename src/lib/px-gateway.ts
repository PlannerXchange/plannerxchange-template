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

import type { ShellRuntimeContext } from "../plannerxchange";

/**
 * Extended context that includes the optional idToken.
 * The shell injects idToken at runtime; the type definition may not include
 * it yet. This avoids coupling the gateway to internal type changes.
 */
interface RuntimeContextWithToken extends ShellRuntimeContext {
  idToken?: string;
}

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
  const rtx = ctx as RuntimeContextWithToken;
  const isLive =
    import.meta.env.VITE_PX_MODE === "live" && !!rtx.idToken;

  if (!isLive) {
    return mockGateway();
  }
  return liveGateway(rtx);
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

function liveGateway(ctx: RuntimeContextWithToken): PxGateway {
  const base =
    import.meta.env.VITE_PX_API_BASE ?? "https://api.plannerxchange.ai";

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
