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
  isPublicDemo,
  isShellHosted,
  type PlannerXchangeApiRequestInit,
  type ShellRuntimeContext
} from "../plannerxchange";

// ---------------------------------------------------------------------------
// Types — extend these as the app grows
// ---------------------------------------------------------------------------

/** Minimal household shape for demo purposes. Replace with your app types. */
export interface HouseholdSummary {
  id: string;
  name: string;
  status?: string;
  updatedAt?: string;
}

export interface ClientSummary {
  id: string;
  householdId: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  updatedAt?: string;
}

export interface AccountSummary {
  id: string;
  householdId: string;
  accountName: string;
  accountType?: string;
  taxTreatment?: string;
  accountStatus?: string;
  accountBalance?: number;
  updatedAt?: string;
}

export interface CanonicalEntityListQuery {
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface CanonicalClientListQuery extends CanonicalEntityListQuery {
  householdId?: string;
}

export interface CanonicalAccountListQuery extends CanonicalEntityListQuery {
  householdId?: string;
}

export interface CanonicalHouseholdCreateInput {
  name: string;
}

export type CanonicalHouseholdUpdateInput = Partial<CanonicalHouseholdCreateInput>;

export interface CanonicalClientCreateInput {
  firstName: string;
  lastName: string;
  householdRole?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
}

export type CanonicalClientUpdateInput = Partial<CanonicalClientCreateInput>;

export interface CanonicalAccountCreateInput {
  accountNumber: string;
  accountName: string;
  custodianName?: string;
  accountType?: string;
  taxType?: string;
  taxTreatment?: string;
  ownerClientIds: string[];
}

export type CanonicalAccountUpdateInput = Partial<
  Omit<CanonicalAccountCreateInput, "accountNumber">
> & { accountStatus?: string };

export interface CanonicalWriteOptions {
  /**
   * Last observed `updatedAt` value from the canonical record.
   * Required by installed-app PATCH and DELETE routes.
   */
  ifMatch?: string;
}

export interface CanonicalSoftDeleteResult {
  entityType: string;
  id: string;
  isDeleted: true;
  deletedAt: string;
  updatedAt: string;
  updatedBy: string;
  cascade?: Record<string, number>;
}

export class PxApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  retryable?: boolean;
  details?: unknown;

  constructor(path: string, status: number, payload?: Record<string, unknown>) {
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : `PlannerXchange API request failed: ${status}`;
    super(`PX API ${path}: ${code ? `${code}: ` : ""}${message}`);
    this.name = "PxApiError";
    this.status = status;
    this.code = code;
    this.requestId =
      typeof payload?.requestId === "string" ? payload.requestId : undefined;
    this.retryable =
      typeof payload?.retryable === "boolean" ? payload.retryable : undefined;
    this.details = payload?.details;
  }
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

interface ListResponse<T> {
  items: T[];
}

// ---------------------------------------------------------------------------
// Mock data — used when the app is not running inside the PlannerXchange shell
// ---------------------------------------------------------------------------

const MOCK_HOUSEHOLDS: HouseholdSummary[] = [
  { id: "hh-mock-001", name: "Example Household A", status: "active" },
  { id: "hh-mock-002", name: "Example Household B", status: "active" },
];

const mockHouseholdStore = new Map<string, HouseholdSummary>(
  MOCK_HOUSEHOLDS.map((household) => [household.id, household])
);
const mockAppDataStore = new Map<string, AppDataRecord>();
const mockClientStore = new Map<string, ClientSummary>();
const mockAccountStore = new Map<string, AccountSummary>();

// ---------------------------------------------------------------------------
// Gateway factory
// ---------------------------------------------------------------------------

export interface PxGateway {
  /** True when the gateway is routing calls to the real PX API. */
  isLive: boolean;

  // Canonical reads
  getHouseholds(query?: CanonicalEntityListQuery): Promise<HouseholdSummary[]>;
  getClients(query?: CanonicalClientListQuery): Promise<ClientSummary[]>;
  getAccounts(query?: CanonicalAccountListQuery): Promise<AccountSummary[]>;

  // Governed canonical writes. These mutate shared PX shell data in live mode.
  createHousehold(input: CanonicalHouseholdCreateInput): Promise<HouseholdSummary>;
  updateHousehold(
    householdId: string,
    input: CanonicalHouseholdUpdateInput,
    options?: CanonicalWriteOptions
  ): Promise<HouseholdSummary>;
  softDeleteHousehold(
    householdId: string,
    options: CanonicalWriteOptions
  ): Promise<CanonicalSoftDeleteResult>;
  createClient(
    householdId: string,
    input: CanonicalClientCreateInput
  ): Promise<ClientSummary>;
  updateClient(
    householdId: string,
    clientId: string,
    input: CanonicalClientUpdateInput,
    options?: CanonicalWriteOptions
  ): Promise<ClientSummary>;
  softDeleteClient(
    householdId: string,
    clientId: string,
    options: CanonicalWriteOptions
  ): Promise<CanonicalSoftDeleteResult>;
  createAccount(
    householdId: string,
    input: CanonicalAccountCreateInput
  ): Promise<AccountSummary>;
  updateAccount(
    householdId: string,
    accountId: string,
    input: CanonicalAccountUpdateInput,
    options?: CanonicalWriteOptions
  ): Promise<AccountSummary>;
  softDeleteAccount(
    householdId: string,
    accountId: string,
    options: CanonicalWriteOptions
  ): Promise<CanonicalSoftDeleteResult>;

  // App-data CRUD
  getAppData<T = unknown>(recordType: string): Promise<AppDataRecord<T>[]>;
  createAppData<T = unknown>(input: AppDataCreateInput<T>): Promise<AppDataRecord<T>>;
  updateAppData<T = unknown>(recordId: string, input: AppDataUpdateInput<T>): Promise<AppDataRecord<T>>;
  softDeleteAppData<T = unknown>(recordId: string): Promise<AppDataRecord<T>>;
}

export function createPxGateway(ctx: ShellRuntimeContext): PxGateway {
  // Detect live mode at runtime from the context itself.
  // When running locally with `vite dev`, main.tsx injects the synthetic
  // mock context. Authenticated dev/prod shell contexts have a real installation
  // ID and shell-managed API fetch. Public demo is shell-rendered but branches
  // to synthetic, non-persistent behavior first.
  //
  // Do NOT use `publicationEnvironment` or build-time env vars for this check.
  // `publicationEnvironment: "dev"` means the real PlannerXchange dev tier,
  // not "offline / mock mode".
  if (isPublicDemo(ctx)) {
    return publicDemoGateway();
  }
  if (!isShellHosted(ctx)) {
    return mockGateway();
  }
  return liveGateway(ctx);
}

function publicDemoGateway(): PxGateway {
  const gateway = mockGateway();
  const rejectWrite = async (): Promise<never> => {
    throw new Error(
      "Public demo mode is synthetic and non-persistent. Keep visitor changes in component memory only."
    );
  };

  return {
    ...gateway,
    createHousehold: rejectWrite,
    updateHousehold: rejectWrite,
    softDeleteHousehold: rejectWrite,
    createClient: rejectWrite,
    updateClient: rejectWrite,
    softDeleteClient: rejectWrite,
    createAccount: rejectWrite,
    updateAccount: rejectWrite,
    softDeleteAccount: rejectWrite,
    createAppData: rejectWrite,
    updateAppData: rejectWrite,
    softDeleteAppData: rejectWrite
  };
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function mockGateway(): PxGateway {
  return {
    isLive: false,

    async getHouseholds(query: CanonicalEntityListQuery = {}) {
      const search = query.search?.trim().toLowerCase();
      return [...mockHouseholdStore.values()]
        .filter((household) => !search || household.name.toLowerCase().includes(search))
        .slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
    },

    async getClients(query: CanonicalClientListQuery = {}): Promise<ClientSummary[]> {
      const search = query.search?.trim().toLowerCase();
      return [...mockClientStore.values()]
        .filter((client) => !query.householdId || client.householdId === query.householdId)
        .filter((client) => {
          const label = client.displayName ?? `${client.firstName ?? ""} ${client.lastName ?? ""}`;
          return !search || label.toLowerCase().includes(search);
        })
        .slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
    },

    async getAccounts(query: CanonicalAccountListQuery = {}): Promise<AccountSummary[]> {
      const search = query.search?.trim().toLowerCase();
      return [...mockAccountStore.values()]
        .filter((account) => !query.householdId || account.householdId === query.householdId)
        .filter((account) => !search || account.accountName.toLowerCase().includes(search))
        .slice(0, query.limit ?? Number.MAX_SAFE_INTEGER);
    },

    async createHousehold(input: CanonicalHouseholdCreateInput): Promise<HouseholdSummary> {
      const now = new Date().toISOString();
      const household: HouseholdSummary = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `hh-mock-${Date.now()}`,
        name: input.name,
        status: "active",
        updatedAt: now,
      };
      mockHouseholdStore.set(household.id, household);
      return household;
    },

    async updateHousehold(
      householdId: string,
      input: CanonicalHouseholdUpdateInput
    ): Promise<HouseholdSummary> {
      const existing = mockHouseholdStore.get(householdId);
      if (!existing) {
        throw new Error(`Mock household not found: ${householdId}`);
      }
      const updated: HouseholdSummary = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      mockHouseholdStore.set(householdId, updated);
      return updated;
    },

    async softDeleteHousehold(
      householdId: string
    ): Promise<CanonicalSoftDeleteResult> {
      const existing = mockHouseholdStore.get(householdId);
      if (!existing) {
        throw new Error(`Mock household not found: ${householdId}`);
      }
      mockHouseholdStore.delete(householdId);
      const deletedAt = new Date().toISOString();
      return {
        entityType: "household",
        id: householdId,
        isDeleted: true,
        deletedAt,
        updatedAt: deletedAt,
        updatedBy: "synthetic-user-context",
      };
    },

    async createClient(
      householdId: string,
      input: CanonicalClientCreateInput
    ): Promise<ClientSummary> {
      if (!mockHouseholdStore.has(householdId)) {
        throw new Error(`Mock household not found: ${householdId}`);
      }
      const now = new Date().toISOString();
      const client: ClientSummary = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `client-mock-${Date.now()}`,
        householdId,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`,
        status: "active",
        updatedAt: now,
      };
      mockClientStore.set(client.id, client);
      return client;
    },

    async updateClient(
      householdId: string,
      clientId: string,
      input: CanonicalClientUpdateInput
    ): Promise<ClientSummary> {
      const existing = mockClientStore.get(clientId);
      if (!existing || existing.householdId !== householdId) {
        throw new Error(`Mock client not found: ${clientId}`);
      }
      const firstName = input.firstName ?? existing.firstName;
      const lastName = input.lastName ?? existing.lastName;
      const updated: ClientSummary = {
        ...existing,
        ...input,
        displayName:
          firstName && lastName ? `${firstName} ${lastName}` : existing.displayName,
        updatedAt: new Date().toISOString(),
      };
      mockClientStore.set(clientId, updated);
      return updated;
    },

    async softDeleteClient(
      householdId: string,
      clientId: string
    ): Promise<CanonicalSoftDeleteResult> {
      const existing = mockClientStore.get(clientId);
      if (!existing || existing.householdId !== householdId) {
        throw new Error(`Mock client not found: ${clientId}`);
      }
      mockClientStore.delete(clientId);
      const deletedAt = new Date().toISOString();
      return {
        entityType: "client",
        id: clientId,
        isDeleted: true,
        deletedAt,
        updatedAt: deletedAt,
        updatedBy: "synthetic-user-context",
      };
    },

    async createAccount(
      householdId: string,
      input: CanonicalAccountCreateInput
    ): Promise<AccountSummary> {
      if (!mockHouseholdStore.has(householdId)) {
        throw new Error(`Mock household not found: ${householdId}`);
      }
      const account: AccountSummary = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `account-mock-${Date.now()}`,
        householdId,
        accountName: input.accountName,
        accountType: input.accountType,
        taxTreatment: input.taxTreatment,
        accountStatus: "active",
        updatedAt: new Date().toISOString(),
      };
      mockAccountStore.set(account.id, account);
      return account;
    },

    async updateAccount(
      householdId: string,
      accountId: string,
      input: CanonicalAccountUpdateInput
    ): Promise<AccountSummary> {
      const existing = mockAccountStore.get(accountId);
      if (!existing || existing.householdId !== householdId) {
        throw new Error(`Mock account not found: ${accountId}`);
      }
      const updated = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      } satisfies AccountSummary;
      mockAccountStore.set(accountId, updated);
      return updated;
    },

    async softDeleteAccount(
      householdId: string,
      accountId: string
    ): Promise<CanonicalSoftDeleteResult> {
      const existing = mockAccountStore.get(accountId);
      if (!existing || existing.householdId !== householdId) {
        throw new Error(`Mock account not found: ${accountId}`);
      }
      mockAccountStore.delete(accountId);
      const deletedAt = new Date().toISOString();
      return {
        entityType: "account",
        id: accountId,
        isDeleted: true,
        deletedAt,
        updatedAt: deletedAt,
        updatedBy: "synthetic-user-context",
      };
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

    async softDeleteAppData<T = unknown>(recordId: string): Promise<AppDataRecord<T>> {
      const existing = mockAppDataStore.get(recordId) as AppDataRecord<T> | undefined;
      if (!existing) {
        throw new Error(`Mock app-data record not found: ${recordId}`);
      }
      const archived: AppDataRecord<T> = {
        ...existing,
        status: "archived",
        updatedAt: new Date().toISOString(),
      };
      mockAppDataStore.set(recordId, archived);
      return archived;
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

  async function readErrorPayload(res: Awaited<ReturnType<typeof pxFetchImpl>>): Promise<Record<string, unknown> | undefined> {
    try {
      const payload = await res.json();
      return payload && typeof payload === "object" ? payload as Record<string, unknown> : undefined;
    } catch {
      return undefined;
    }
  }

  async function pxFetch<T>(path: string, init?: PlannerXchangeApiRequestInit): Promise<T> {
    const res = await pxFetchImpl(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new PxApiError(path, res.status, await readErrorPayload(res));
    }
    return res.json() as Promise<T>;
  }

  function jsonInit(
    method: string,
    body: unknown,
    options?: CanonicalWriteOptions
  ): PlannerXchangeApiRequestInit {
    return {
      method,
      headers: options?.ifMatch ? { "If-Match": options.ifMatch } : {},
      body: JSON.stringify(body),
    };
  }

  function deleteInit(options: CanonicalWriteOptions): PlannerXchangeApiRequestInit {
    return {
      method: "DELETE",
      headers: options.ifMatch ? { "If-Match": options.ifMatch } : {},
    };
  }

  function listItems<T>(payload: T[] | ListResponse<T>): T[] {
    return Array.isArray(payload) ? payload : payload.items ?? [];
  }

  function toQueryString(query: CanonicalEntityListQuery): string {
    const params = new URLSearchParams();
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.limit) params.set("limit", String(query.limit));
    if (query.cursor?.trim()) params.set("cursor", query.cursor.trim());
    const value = params.toString();
    return value ? `?${value}` : "";
  }

  return {
    isLive: true,

    async getHouseholds(query: CanonicalEntityListQuery = {}) {
      const payload = await pxFetch<HouseholdSummary[] | ListResponse<HouseholdSummary>>(
        `/households${toQueryString(query)}`
      );
      return listItems(payload);
    },

    async getClients(query: CanonicalClientListQuery = {}): Promise<ClientSummary[]> {
      const path = query.householdId
        ? `/households/${encodeURIComponent(query.householdId)}/clients`
        : "/clients";
      const payload = await pxFetch<ClientSummary[] | ListResponse<ClientSummary>>(
        `${path}${toQueryString(query)}`
      );
      return listItems(payload);
    },

    async getAccounts(query: CanonicalAccountListQuery = {}): Promise<AccountSummary[]> {
      const path = query.householdId
        ? `/households/${encodeURIComponent(query.householdId)}/accounts`
        : "/accounts";
      const payload = await pxFetch<AccountSummary[] | ListResponse<AccountSummary>>(
        `${path}${toQueryString(query)}`
      );
      return listItems(payload);
    },

    async createHousehold(input: CanonicalHouseholdCreateInput): Promise<HouseholdSummary> {
      return pxFetch<HouseholdSummary>("/households", jsonInit("POST", input));
    },

    async updateHousehold(
      householdId: string,
      input: CanonicalHouseholdUpdateInput,
      options?: CanonicalWriteOptions
    ): Promise<HouseholdSummary> {
      return pxFetch<HouseholdSummary>(
        `/households/${encodeURIComponent(householdId)}`,
        jsonInit("PATCH", input, options)
      );
    },

    async softDeleteHousehold(
      householdId: string,
      options: CanonicalWriteOptions
    ): Promise<CanonicalSoftDeleteResult> {
      return pxFetch<CanonicalSoftDeleteResult>(
        `/households/${encodeURIComponent(householdId)}`,
        deleteInit(options)
      );
    },

    async createClient(
      householdId: string,
      input: CanonicalClientCreateInput
    ): Promise<ClientSummary> {
      return pxFetch<ClientSummary>(
        `/households/${encodeURIComponent(householdId)}/clients`,
        jsonInit("POST", input)
      );
    },

    async updateClient(
      householdId: string,
      clientId: string,
      input: CanonicalClientUpdateInput,
      options?: CanonicalWriteOptions
    ): Promise<ClientSummary> {
      return pxFetch<ClientSummary>(
        `/households/${encodeURIComponent(householdId)}/clients/${encodeURIComponent(clientId)}`,
        jsonInit("PATCH", input, options)
      );
    },

    async softDeleteClient(
      householdId: string,
      clientId: string,
      options: CanonicalWriteOptions
    ): Promise<CanonicalSoftDeleteResult> {
      return pxFetch<CanonicalSoftDeleteResult>(
        `/households/${encodeURIComponent(householdId)}/clients/${encodeURIComponent(clientId)}`,
        deleteInit(options)
      );
    },

    async createAccount(
      householdId: string,
      input: CanonicalAccountCreateInput
    ): Promise<AccountSummary> {
      return pxFetch<AccountSummary>(
        `/households/${encodeURIComponent(householdId)}/accounts`,
        jsonInit("POST", input)
      );
    },

    async updateAccount(
      householdId: string,
      accountId: string,
      input: CanonicalAccountUpdateInput,
      options?: CanonicalWriteOptions
    ): Promise<AccountSummary> {
      return pxFetch<AccountSummary>(
        `/households/${encodeURIComponent(householdId)}/accounts/${encodeURIComponent(accountId)}`,
        jsonInit("PATCH", input, options)
      );
    },

    async softDeleteAccount(
      householdId: string,
      accountId: string,
      options: CanonicalWriteOptions
    ): Promise<CanonicalSoftDeleteResult> {
      return pxFetch<CanonicalSoftDeleteResult>(
        `/households/${encodeURIComponent(householdId)}/accounts/${encodeURIComponent(accountId)}`,
        deleteInit(options)
      );
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

    async softDeleteAppData<T = unknown>(recordId: string): Promise<AppDataRecord<T>> {
      return pxFetch<AppDataRecord<T>>(`/app-data/${encodeURIComponent(recordId)}`, {
        method: "DELETE",
      });
    },
  };
}
