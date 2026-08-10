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
  assert.match(ambiguous.issues.join(" "), /dynamic request contract/);
});
