import assert from "node:assert/strict";
import test from "node:test";

import { analyzeAppDataContract, analyzeAppDataOperations, selectAppDataArtifactFiles } from "./app-data-contract.mjs";
import { resolveAppDataRequestShape } from "./app-data-request-shape.mjs";

const files = (entries) => Object.entries(entries).map(([path, content]) => ({ path, content }));
const trustedAppDataTypes = `import type { AppDataCreateInput, AppDataUpdateInput } from "@plannerxchange/types";`;
const manifest = { permissions: ["app_data.read", "app_data.write"] };

test("accepts SDK record lifecycle with server-returned record ids", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({
      "src/repository.ts": `${trustedAppDataTypes} export async function save(api, input: AppDataCreateInput, patch: AppDataUpdateInput) { const list = await api.listAppData(); const made = await api.createAppDataRecord(input); await api.updateAppDataRecord(made.recordId, patch); return api.getAppDataRecord(list.items[0].recordId); }`
    }),
    distFiles: files({
      "dist/plugin.js": `a.listAppData();a.createAppDataRecord(i);a.updateAppDataRecord(r.recordId,p);a.getAppDataRecord(l.items[0].recordId);`
    })
  });
  assert.deepEqual(issues, []);
});

test("rejects invalid SDK request envelopes", () => {
  const operations = analyzeAppDataOperations(files({
    "src/repository.ts": `sdk.createAppDataRecord({recordType:"state",schemaVersion:1,value:state});sdk.updateAppDataRecord(recordId,{recordType:"other"});`
  }), "source");
  assert.match(operations[0].issues.join(" "), /missing create field status/);
  assert.match(operations[0].issues.join(" "), /unsupported create field value/);
  assert.match(operations[1].issues.join(" "), /no mutable fields/);
});

test("rejects a legacy SDK response projection", () => {
  const operations = analyzeAppDataOperations(files({
    "src/repository.ts": `export async function load(api){const result=await api.listAppData();return result.value}`
  }), "source");
  assert.match(operations[0].issues.join(" "), /legacy top-level value response/);
});

test("rejects legacy PUT, value envelopes, and fabricated keys", () => {
  const operations = analyzeAppDataOperations(files({
    "src/repository.ts": `const key="state-"+clientId; const response=await ctx.authenticatedFetch("/app-data/"+key,{method:"PUT",body:JSON.stringify({value})}); const body=await response.json(); return body.value;`
  }), "source");
  assert.equal(operations.length, 1);
  assert.match(operations[0].issues.join(" "), /PUT/);
  assert.match(operations[0].issues.join(" "), /fabricated/);
  assert.match(operations[0].issues.join(" "), /value/);
});

test("accepts aliases and typed local wrappers", () => {
  const operations = analyzeAppDataOperations(files({
    "src/repository.ts": `${trustedAppDataTypes} const create=sdk.createAppDataRecord; const send=ctx.authenticatedFetch; async function make(input: AppDataCreateInput){await create(input);return send("/app-data",{method:"POST",body:JSON.stringify(input)});}`
  }), "source");
  assert.equal(operations.length, 2);
  assert.ok(operations.every((operation) => operation.issues.length === 0));
});

test("accepts initializer forwarding into module-scoped app-data state", () => {
  const operations = analyzeAppDataOperations(files({
    "src/plugin.ts": `import { configureStore as initStore } from "./store";export function mount(ctx,demo){initStore(demo?undefined:ctx.authenticatedFetch,demo)}`,
    "src/store.ts": `let transport;export function configureStore(fetcher,demo){transport=demo?undefined:fetcher}export function load(){return transport("/app-data")}export function save(input){return transport("/app-data",{method:"POST",body:JSON.stringify(input)})}`
  }), "source");
  assert.equal(operations.length, 2);
  assert.ok(operations.every((operation) => !operation.issues.includes("gateway adapter is unresolved")), JSON.stringify(operations));
});

test("does not silently drop an unresolved app-data adapter", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": `export function mount(){return opaqueTransport("/app-data",{method:"POST",body:JSON.stringify(input)})}` }),
    distFiles: []
  });
  assert.ok(issues.some((issue) => issue.code === "app-data-analysis-indeterminate"));
  assert.equal(issues.some((issue) => issue.code === "app-data-request-contract-invalid"), false);
});

test("discovers a statically named app-data route", () => {
  const operations = analyzeAppDataOperations(files({
    "src/store.ts": `const collectionPath="/app-data";export function load(){return authenticatedFetch(collectionPath)}`
  }), "source");
  assert.equal(operations.length, 1);
  assert.deepEqual(operations[0].issues, []);
});

test("discovers app-data routes appended to a configured gateway base URL", () => {
  const operations = analyzeAppDataOperations(files({
    "src/store.ts": `export function load(ctx){return ctx.authenticatedFetch(ctx.apiBaseUrl + "/app-data?recordType=state")}`
  }), "source");
  assert.equal(operations.length, 1);
  assert.deepEqual(operations[0].issues, []);
});

test("does not classify nested payload properties as request fields", () => {
  const [operation] = analyzeAppDataOperations(files({
    "src/repository.ts": `export function create(ctx){return ctx.authenticatedFetch("/app-data",{method:"POST",body:JSON.stringify({recordType:"state",status:"draft",schemaVersion:1,payload:{settings:{currency:"USD"},budgets:[]}})})}`
  }), "source");
  assert.deepEqual(operation.requestFields, ["payload", "recordType", "schemaVersion", "status"]);
  assert.deepEqual(operation.issues, []);
});

test("keeps permission findings independent from request compliance", () => {
  const issues = analyzeAppDataContract({
    manifest: { permissions: [] },
    sourceFiles: files({ "src/plugin.ts": `${trustedAppDataTypes} export function run(input: AppDataCreateInput){api.listAppData();api.createAppDataRecord(input);}` }),
    distFiles: files({ "dist/plugin.js": `a.listAppData();a.createAppDataRecord(i);` })
  });
  assert.ok(issues.some((issue) => issue.code === "app-data-read-scope-missing"));
  assert.ok(issues.some((issue) => issue.code === "app-data-write-scope-missing"));
  assert.equal(issues.some((issue) => issue.code === "app-data-request-contract-invalid"), false);
});

test("ignores unreachable source and requires each reachable artifact marker", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({
      "src/plugin.ts": `api.listAppData();`,
      "src/dead.ts": `fetch("/app-data/local",{method:"PUT",body:JSON.stringify({value:1})});`
    }),
    distFiles: files({ "dist/plugin.js": `a.listAppData();` }),
    reachableSourceFiles: ["src/plugin.ts"]
  });
  assert.deepEqual(issues, []);
});

test("rejects invalid query fields and missing committed operations", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": `${trustedAppDataTypes} export function run(input: AppDataCreateInput){fetch("/app-data?key=legacy");api.createAppDataRecord(input);}` }),
    distFiles: files({ "dist/plugin.js": `fetch("/app-data?key=legacy");` })
  });
  assert.ok(issues.some((issue) => issue.code === "app-data-request-contract-invalid"));
  assert.ok(issues.some((issue) => issue.code === "app-data-build-artifact-missing"));
});

test("rejects unsupported SDK list queries and unresolved generic record ids", () => {
  const operations = analyzeAppDataOperations(files({
    "src/plugin.ts": `export function load(api,id){api.listAppData({recordType:"state",key:"legacy"});return api.getAppDataRecord(id)}`
  }), "source");
  assert.match(operations[0].issues.join(" "), /unsupported query field key/);
  assert.match(operations[1].issues.join(" "), /provenance is unresolved/);
});

test("rejects a locally fabricated variable even when it is named recordId", () => {
  const [operation] = analyzeAppDataOperations(files({
    "src/plugin.ts": `export function load(api, clientId){const recordId="state-"+clientId;return api.getAppDataRecord(recordId)}`
  }), "source");
  assert.match(operation.issues.join(" "), /locally fabricated/);
});

test("accepts a source-validated wrapper retained after minification", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": `${trustedAppDataTypes} export function create(input: AppDataCreateInput){return authenticatedFetch("/app-data",{method:"POST",body:JSON.stringify(input)})}` }),
    distFiles: files({ "dist/plugin.js": `const r=x.authenticatedFetch;function a(e){return r("/app-data",{method:"POST",body:JSON.stringify(e)})}` })
  });
  assert.deepEqual(issues, []);
});

test("ignores an unreferenced local helper in a reachable file", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": `export function mount(){return null} function abandoned(){return fetch("/app-data/local",{method:"PUT",body:JSON.stringify({value:1})})}` }),
    distFiles: files({ "dist/plugin.js": `export function mount(){return null}` })
  });
  assert.deepEqual(issues, []);
});

test("ignores an exported app-data helper that is never called and absent from the build", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({
      "src/plugin.ts": `export function mount(){return null} export function removeUnused(){return fetch("/app-data/local",{method:"PUT",body:JSON.stringify({value:1})})}`
    }),
    distFiles: files({ "dist/plugin.js": `export function mount(){return null}` })
  });
  assert.deepEqual(issues, []);
});

test("retains an exported app-data helper when reachable code calls it", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({
      "src/plugin.ts": `export function removeStored(){return fetch("/app-data/local",{method:"PUT",body:JSON.stringify({value:1})})} export function mount(){void removeStored()}`
    }),
    distFiles: files({
      "dist/plugin.js": `function r(){return fetch("/app-data/local",{method:"PUT",body:JSON.stringify({value:1})})}export function mount(){r()}`
    })
  });
  assert.ok(issues.some((issue) => issue.code === "app-data-request-contract-invalid"));
});

test("distinguishes relevant alias uncertainty from unrelated unresolved imports", () => {
  const sourceFiles = files({
    "src/plugin.ts": `export function mount(){return null}`,
    "src/lib/store.ts": `export function load(api){return api.listAppData()}`,
  });
  const relevant = analyzeAppDataContract({ manifest, sourceFiles, distFiles: [], reachableSourceFiles: ["src/plugin.ts"], relevantResolverDiagnostics: ["Ambiguous local import alias: @/lib/store"] });
  assert.ok(relevant.some((issue) => issue.code === "app-data-analysis-indeterminate"));
  const unrelated = analyzeAppDataContract({ manifest, sourceFiles, distFiles: [], reachableSourceFiles: ["src/plugin.ts"], relevantResolverDiagnostics: ["Unresolved local import alias: @/components/chart"] });
  assert.equal(unrelated.some((issue) => issue.code === "app-data-analysis-indeterminate"), false);
});

test("accepts production-minified initializer, cached server id, and nested payload value", () => {
  const filler = `const optionalContext="${"x".repeat(60_000)}";void optionalContext;`;
  const operations = analyzeAppDataOperations(files({
    "dist/plugin.js": `
      const cache=new Map;let tx;
      function $init(gateway,disabled=false){tx=disabled?void 0:gateway}
      async function parse(response){return await response.json()}
      async function load(owner){const query=new URLSearchParams({recordType:"state",clientUserId:owner,limit:"100"}),response=await tx(\`/app-data?\${query.toString()}\`),selected=((await parse(response)).items??[])[0],entry={recordId:selected?.recordId};return cache.set(owner,entry),entry}
      async function save(owner,value){const current=cache.get(owner);return current?.recordId?tx(\`/app-data/\${current.recordId}\`,{method:"PATCH",body:JSON.stringify({payload:{data:value}})}):tx("/app-data",{method:"POST",body:JSON.stringify({recordType:"state",status:"draft",schemaVersion:1,clientUserId:owner,payload:{data:value}})})}
      ${filler}
      const plugin={mount(context){$init(context?.authenticatedFetch,false);return load("selected-owner")}};void plugin;
    `,
  }), "dist");
  assert.deepEqual(operations.map((operation) => operation.operation), ["list", "update", "create"]);
  assert.ok(operations.every((operation) => operation.issues.length === 0), JSON.stringify(operations));
  assert.deepEqual(operations[0].queryFields, ["clientUserId", "limit", "recordType"]);
  assert.equal(operations[1].recordIdProvenance, "server");
  assert.deepEqual(operations[1].requestFields, ["payload"]);
  assert.equal(typeof operations[1].requestFieldOffsets.payload, "number");
  assert.equal(typeof operations[2].requestFieldOffsets.status, "number");
});

test("excludes comparison-heavy vendor artifacts from app-data preflight", () => {
  const comparisonDensity = Array.from(
    { length: 4_000 },
    (_, index) => `const v${index}=left${index}<right${index}?left${index}:right${index};`
  ).join("");
  const selected = selectAppDataArtifactFiles(files({
    "dist/app.js": `const send=runtime.authenticatedFetch;export function mount(){return send("/app-data?recordType=workspace_state")}`,
    "dist/runtime.js": `export const send=runtime.authenticatedFetch;`,
    "dist/vendor-react.js": comparisonDensity,
    "dist/vendor-components.js": comparisonDensity,
  }));

  assert.deepEqual(selected.map((entry) => entry.path), ["dist/app.js", "dist/runtime.js"]);
});

test("runtime comparisons do not hide later app-data request fields", () => {
  const shape = resolveAppDataRequestShape({
    expression: `{ recordType: "state", payload: { data: left < right ? left >> 1 : right, label: "<ImportPanel />" }, status: "draft", schemaVersion: 1 }`,
    source: "",
    kind: "create",
  });

  assert.equal(shape.resolved, true);
  assert.deepEqual(shape.fields, ["payload", "recordType", "schemaVersion", "status"]);
  assert.deepEqual(shape.issues, []);
});

test("does not treat an enclosing promise callback as another gateway operation", () => {
  const operations = analyzeAppDataOperations(files({
    "src/store.ts": `const send=runtime.authenticatedFetch;export function save(queue,input){return queue.then(async()=>send("/app-data",{method:"POST",body:JSON.stringify(input)}))}`,
  }), "source");
  assert.equal(operations.length, 1);
  assert.equal(operations[0].operation, "create");
});

test("distinguishes nested local value content from a removed top-level value envelope", () => {
  const operations = analyzeAppDataOperations(files({
    "src/store.ts": `export function valid(ctx,value){return ctx.authenticatedFetch("/app-data",{method:"POST",body:JSON.stringify({recordType:"state",status:"draft",schemaVersion:1,payload:{data:value}})})}export function invalid(ctx,value){return ctx.authenticatedFetch("/app-data",{method:"POST",body:JSON.stringify({recordType:"state",status:"draft",schemaVersion:1,value})})}`,
  }), "source");
  assert.deepEqual(operations[0].issues, []);
  assert.match(operations[1].issues.join(" "), /legacy value request envelope/);
});

test("trusts only verified PX type imports and checks shadowed local types structurally", () => {
  const trusted = resolveAppDataRequestShape({
    expression: "input",
    source: `import type { AppDataCreateInput as CreateInput } from "@plannerxchange/types"; function save(input: CreateInput) {}`,
    kind: "create",
  });
  assert.equal(trusted.provenance, "trusted_public_type");
  assert.deepEqual(trusted.issues, []);

  const shadowed = resolveAppDataRequestShape({
    expression: "input",
    source: `interface AppDataCreateInput { recordType: string; status?: "draft"; schemaVersion?: number; payload: unknown } function save(input: AppDataCreateInput) {}`,
    kind: "create",
  });
  assert.equal(shadowed.provenance, "resolved_local_type");
  assert.match(shadowed.issues.join(" "), /status is optional/);
  assert.match(shadowed.issues.join(" "), /schemaVersion is optional/);
  assert.match(shadowed.issues.join(" "), /payload type must be an object/);
});

test("rejects all-optional and over-broad update types", () => {
  const shape = resolveAppDataRequestShape({
    expression: "input",
    source: `type Patch = { title?: string; status?: "draft" | "final" | "archived"; payload?: Record<string, unknown>; clientUserId?: string }; function patch(input: Patch) {}`,
    kind: "update",
  });
  assert.match(shape.issues.join(" "), /allows an empty patch/);
  assert.match(shape.issues.join(" "), /unsupported update field clientUserId/);
});

test("resolves static spreads and validates literal request values", () => {
  const source = `
    type Base = { recordType: string; status: "draft" | "final" | "archived"; schemaVersion: number; payload: Record<string, unknown> };
    const base: Base = { recordType: "state", status: "draft", schemaVersion: 1, payload: {} };
    const input = { ...base, title: "Current" } satisfies Base & { title: string };
  `;
  const spread = resolveAppDataRequestShape({ expression: "input", source, kind: "create" });
  assert.equal(spread.resolved, true);
  assert.equal(spread.provenance, "resolved_spread");
  assert.deepEqual(spread.issues, []);

  const invalid = resolveAppDataRequestShape({
    expression: `{ recordType: "state", status: "other", schemaVersion: 0, payload: [], sourceRefs: [{ sourceType: "canonical_account" }] }`,
    source: "",
    kind: "create",
  });
  assert.match(invalid.issues.join(" "), /invalid status value/);
  assert.match(invalid.issues.join(" "), /positive integer/);
  assert.match(invalid.issues.join(" "), /payload must be an object/);
  assert.match(invalid.issues.join(" "), /invalid sourceRefs entry/);
});

test("validates every statically resolvable conditional create branch", () => {
  const valid = resolveAppDataRequestShape({
    expression: `useFirst ? { recordType: "state", status: "draft", schemaVersion: 1, payload: first } : { recordType: "state", status: "final", schemaVersion: 1, payload: second }`,
    source: "",
    kind: "create",
  });
  assert.equal(valid.resolved, true);
  assert.deepEqual(valid.issues, []);
  const missing = resolveAppDataRequestShape({
    expression: `useFirst ? { recordType: "state", status: "draft", schemaVersion: 1, payload: first } : { recordType: "state", schemaVersion: 1, payload: second }`,
    source: "",
    kind: "create",
  });
  assert.match(missing.issues.join(" "), /required create field status is optional/);
});

test("treats a deliberately dynamic create body as an app-owned preflight finding", () => {
  const call = `export function save(api,input){return api.createAppDataRecord({...input,schemaVersion:1})}`;
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": call }),
    distFiles: files({ "dist/plugin.js": call }),
  });
  assert.ok(issues.some((issue) => issue.code === "app-data-request-contract-invalid"));
  assert.equal(issues.some((issue) => issue.code === "app-data-analysis-indeterminate"), false);
  assert.match(issues.map((issue) => issue.message).join(" "), /dynamic request contract/);
});

test("accepts all five app-data operations with a distant server-id cache and erased artifact types", () => {
  const distant = "x".repeat(8_000);
  const source = `
    type Association = { status: "draft"; clientUserId: string };
    type StoredState = { recordId: string; payload: Record<string, unknown> };
    let transport;
    const records = new Map<string, StoredState>();
    function configure(next) { transport = next; }
    async function parseJson(response) { return await response.json(); }
    async function locate(clientUserId) {
      const query = new URLSearchParams({ recordType: "state", clientUserId });
      const response = await transport("/app-data?" + query.toString());
      const page = await parseJson(response);
      const listed = page.items.find((item) => item.recordType === "state");
      if (listed?.recordId) records.set(clientUserId, { recordId: listed.recordId, payload: listed.payload });
      const record = records.get(clientUserId);
      if (record?.recordId) return transport("/app-data/" + encodeURIComponent(record.recordId));
    }
    const filler = "${distant}";
    async function save(clientUserId, payload, association: Association) {
      const record = records.get(clientUserId);
      if (record?.recordId) return transport("/app-data/" + encodeURIComponent(record.recordId), { method: "PATCH", body: JSON.stringify({ payload }) });
      const base = { recordType: "state", schemaVersion: 1 };
      const response = await transport("/app-data", { method: "POST", body: JSON.stringify({ ...base, ...association, payload }) });
      const created = await parseJson(response);
      records.set(clientUserId, { recordId: created.recordId, payload: created.payload });
      return created;
    }
    async function remove(clientUserId) {
      const record = records.get(clientUserId);
      if (record?.recordId) return transport("/app-data/" + encodeURIComponent(record.recordId), { method: "DELETE" });
    }
    export function mount(context) {
      configure(context.authenticatedFetch);
      void locate("selected-client");
      void save("selected-client", {}, { status: "draft", clientUserId: "selected-client" });
      void remove("selected-client");
    }
  `;
  const artifact = `let t;const c=new Map;function q(e){return t=e}async function j(e){return await e.json()}async function l(e){const r=new URLSearchParams({recordType:"state",clientUserId:e}),a=await t("/app-data?"+r.toString()),o=await j(a),n=o.items.find(e=>"state"===e.recordType);n?.recordId&&c.set(e,{recordId:n.recordId,payload:n.payload});const i=c.get(e);if(i?.recordId)return t("/app-data/"+encodeURIComponent(i.recordId))}const f="${distant}";async function s(e,r,a){const o=c.get(e);if(o?.recordId)return t("/app-data/"+encodeURIComponent(o.recordId),{method:"PATCH",body:JSON.stringify({payload:r})});const n=await t("/app-data",{method:"POST",body:JSON.stringify({recordType:"state",schemaVersion:1,...a,payload:r})}),i=await j(n);return c.set(e,{recordId:i.recordId,payload:i.payload}),i}async function d(e){const r=c.get(e);if(r?.recordId)return t("/app-data/"+encodeURIComponent(r.recordId),{method:"DELETE"})}export function mount(e){q(e.authenticatedFetch),l("selected-client"),s("selected-client",{},{status:"draft",clientUserId:"selected-client"}),d("selected-client")}`;
  const operations = analyzeAppDataOperations(files({ "src/plugin.ts": source }), "source");
  assert.deepEqual(operations.map((entry) => entry.operation).sort(), ["create", "delete", "get", "list", "update"]);
  assert.ok(operations.every((entry) => entry.issues.length === 0), JSON.stringify(operations));
  assert.deepEqual(analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/plugin.ts": source }),
    distFiles: files({ "dist/plugin.js": artifact }),
  }), []);
});

test("follows generic response helpers through filtered list selection and returned record aliases", () => {
  const source = `
    let transport;
    async function requireJson(response) { return await response.json(); }
    async function locate(contextId) {
      const query = new URLSearchParams({ recordType: "workspace_state", clientUserId: contextId });
      const response = await transport("/app-data?" + query.toString());
      const page = await requireJson(response);
      const records = (page.items ?? []).filter((record) => record.recordType === "workspace_state");
      return records[0];
    }
    export async function refresh(contextId) {
      const existing = await locate(contextId);
      if (existing?.recordId) return transport("/app-data/" + encodeURIComponent(existing.recordId));
    }
    export function mount(context) { transport = context.authenticatedFetch; void refresh("selected-context"); }
  `;
  const operations = analyzeAppDataOperations(files({ "src/store.ts": source }), "source");
  assert.deepEqual(operations.map((entry) => entry.operation).sort(), ["get", "list"]);
  assert.ok(operations.every((entry) => entry.issues.length === 0), JSON.stringify(operations));
  assert.equal(operations.find((entry) => entry.operation === "get")?.recordIdProvenance, "server");
});

test("uses one matching committed operation to resolve only sole source id uncertainty", () => {
  const source = `
    let transport;
    const helpers = { async locate(contextId) { const response = await transport("/app-data?recordType=workspace_state&clientUserId=" + encodeURIComponent(contextId)); return ((await response.json()).items ?? [])[0]; } };
    export async function refresh(contextId) { const existing = await helpers.locate(contextId); if (existing?.recordId) return transport("/app-data/" + encodeURIComponent(existing.recordId)); }
    export function mount(context) { transport = context.authenticatedFetch; void refresh("selected-context"); }
  `;
  const artifact = `let t;export async function refresh(e){const r=await t("/app-data?recordType=workspace_state&clientUserId="+encodeURIComponent(e)),a=((await r.json()).items??[])[0];if(a?.recordId)return t("/app-data/"+encodeURIComponent(a.recordId))}export function mount(e){t=e.authenticatedFetch,refresh("selected-context")}`;
  assert.deepEqual(analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/store.ts": source }),
    distFiles: files({ "dist/plugin.js": artifact })
  }), []);
});

test("artifact server-id evidence never suppresses fabricated source ids or ambiguous matches", () => {
  const fabricated = `let transport;export function remove(clientUserId){const recordId="workspace-"+clientUserId;return transport("/app-data/"+recordId,{method:"DELETE"})}export function mount(context){transport=context.authenticatedFetch;remove("selected-context")}`;
  const validArtifact = `let t;export async function remove(e){const r=await t("/app-data?recordType=workspace_state&clientUserId="+e),a=((await r.json()).items??[])[0];if(a?.recordId)return t("/app-data/"+a.recordId,{method:"DELETE"})}export function mount(e){t=e.authenticatedFetch}`;
  const fabricatedIssues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/store.ts": fabricated }),
    distFiles: files({ "dist/plugin.js": validArtifact })
  });
  assert.ok(fabricatedIssues.some((issue) => issue.code === "app-data-request-contract-invalid" && /fabricated/.test(issue.message)));

  const unresolved = `let transport;const helpers={locate:async contextId=>({recordId:await opaque(contextId)})};export async function refresh(contextId){const existing=await helpers.locate(contextId);if(existing?.recordId)return transport("/app-data/"+existing.recordId)}export function mount(context){transport=context.authenticatedFetch;refresh("selected-context")}`;
  const ambiguousIssues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({ "src/store.ts": unresolved }),
    distFiles: files({ "dist/one.js": validArtifact, "dist/two.js": validArtifact })
  });
  assert.ok(ambiguousIssues.some((issue) => issue.code === "app-data-analysis-indeterminate"));
});

test("the public gateway source retains the strict app-data type contract", async () => {
  const gateway = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/lib/px-gateway.ts", import.meta.url), "utf8"));
  const createBody = /export interface AppDataCreateInput[\s\S]*?\n\}/.exec(gateway)?.[0] ?? "";
  const updateBody = /export type AppDataUpdateInput[\s\S]*?;\n/.exec(gateway)?.[0] ?? "";
  assert.match(createBody, /status:\s*"draft"/);
  assert.match(createBody, /schemaVersion:\s*number/);
  assert.match(createBody, /payload:\s*T/);
  assert.doesNotMatch(updateBody, /clientUserId|householdId|accountId|sourceRefs/);
  assert.doesNotMatch(gateway, /schemaVersion:\s*input\.schemaVersion\s*\?\?/);
});

test("resolves configured local type imports structurally and fails closed on ambiguity", () => {
  const source = `import type { CreateShape as LocalCreate } from "@/contracts"; function save(input: LocalCreate) {}`;
  const contract = `export interface CreateShape { recordType: string; status: "draft" | "final" | "archived"; schemaVersion: number; payload: Record<string, unknown> }`;
  const resolved = resolveAppDataRequestShape({ expression: "input", source, typeSources: [contract], kind: "create" });
  assert.equal(resolved.provenance, "resolved_local_type");
  assert.deepEqual(resolved.issues, []);
  const ambiguous = resolveAppDataRequestShape({ expression: "input", source, typeSources: [contract, contract], kind: "create" });
  assert.equal(ambiguous.resolved, false);
});

test("validates mixed invalid request-property types", () => {
  const source = `interface BadCreate { recordType: string; status: "draft" | "other"; schemaVersion: number | string; payload: Record<string, unknown> | string } function save(input: BadCreate) {}`;
  const shape = resolveAppDataRequestShape({ expression: "input", source, kind: "create" });
  assert.match(shape.issues.join(" "), /status type/);
  assert.match(shape.issues.join(" "), /schemaVersion type/);
  assert.match(shape.issues.join(" "), /payload type/);
});

test("only request-reachable type modules influence template preflight resolution", () => {
  const good = `export interface CreateShape { recordType: string; status: "draft" | "final" | "archived"; schemaVersion: number; payload: Record<string, unknown> }`;
  const call = `import type { CreateShape } from "@/contracts"; export function save(api, input: CreateShape) { return api.createAppDataRecord(input); }`;
  const [resolved] = analyzeAppDataOperations([
    { path: "src/store.ts", content: call },
    { path: "src/contracts.ts", content: good },
    { path: "src/unrelated.ts", content: `interface CreateShape { value?: string }` },
  ], "source");
  assert.deepEqual(resolved.issues, []);
  assert.equal(resolved.requestShapeProvenance, "resolved_local_type");

  const [ambiguous] = analyzeAppDataOperations([
    { path: "src/store.ts", content: call },
    { path: "src/one/contracts.ts", content: good },
    { path: "src/two/contracts.ts", content: good },
  ], "source");
  assert.match(ambiguous.issues.join(" "), /request shape resolution unavailable/);
});
