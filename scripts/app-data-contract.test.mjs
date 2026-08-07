import assert from "node:assert/strict";
import test from "node:test";

import { analyzeAppDataContract, analyzeAppDataOperations } from "./app-data-contract.mjs";

const files = (entries) => Object.entries(entries).map(([path, content]) => ({ path, content }));
const manifest = { permissions: ["app_data.read", "app_data.write"] };

test("accepts SDK record lifecycle with server-returned record ids", () => {
  const issues = analyzeAppDataContract({
    manifest,
    sourceFiles: files({
      "src/repository.ts": `export async function save(api, input: AppDataCreateInput, patch: AppDataUpdateInput) { const list = await api.listAppData(); const made = await api.createAppDataRecord(input); await api.updateAppDataRecord(made.recordId, patch); return api.getAppDataRecord(list.items[0].recordId); }`
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
    "src/repository.ts": `const create=sdk.createAppDataRecord; const send=ctx.authenticatedFetch; async function make(input: AppDataCreateInput){await create(input);return send("/app-data",{method:"POST",body:JSON.stringify(input)});}`
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
    sourceFiles: files({ "src/plugin.ts": `export function run(input: AppDataCreateInput){api.listAppData();api.createAppDataRecord(input);}` }),
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
    sourceFiles: files({ "src/plugin.ts": `export function run(input: AppDataCreateInput){fetch("/app-data?key=legacy");api.createAppDataRecord(input);}` }),
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
    sourceFiles: files({ "src/plugin.ts": `export function create(input: AppDataCreateInput){return authenticatedFetch("/app-data",{method:"POST",body:JSON.stringify(input)})}` }),
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
