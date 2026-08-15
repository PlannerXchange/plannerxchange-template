import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCanonicalIntegrationContract, CANONICAL_INTEGRATION_CATEGORIES } from "./canonical-integration-contract.mjs";

const transactionImport = {
  id: "transactions-import",
  source: "csv_upload",
  purpose: "Import canonical transactions through PX.",
  dataClasses: ["transactions"],
  target: "px_import_session",
  supportedModes: ["canonical_store"],
  canonicalEntityHints: ["transaction"]
};
const transactionDeclaration = {
  id: "transactions-read",
  category: "transactions",
  required: true,
  scopes: ["read"],
  selectionEntity: "account",
  purpose: "Read selected-account transactions."
};

function analyze({ manifest = {}, source = {}, dist = {}, publishManifest } = {}) {
  return analyzeCanonicalIntegrationContract({
    manifest,
    publishManifest,
    sourceFiles: Object.entries(source).map(([path, content]) => ({ path, content })),
    distFiles: Object.entries(dist).map(([path, content]) => ({ path, content }))
  });
}

test("import plus a same-category working surface requires permission declaration and read", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [transactionImport] },
    source: { "src/routes.tsx": `<a href="/transactions">Transactions</a>` }
  });
  const finding = issues.find((entry) => entry.code === "canonical-data-integration-incomplete");
  assert.ok(finding);
  assert.match(finding.message, /canonical\.transaction\.read/);
  assert.match(finding.message, /canonicalDataAccessDeclarations/);
  assert.match(finding.message, /GET\/SDK read/);
});

test("a generic free-text PX entity with local identity is rejected", () => {
  const issues = analyze({
    manifest: { dataPortabilityMode: "plannerxchange_portable" },
    source: {
      "src/session.tsx": `<label>Client Name</label>\n<input type="text" name="clientName" />\nconst clientId = crypto.randomUUID();`,
      "src/store.ts": `authenticatedFetch("/app-data"); const client_label = "selected";`
    }
  });
  assert.ok(issues.some((entry) => entry.code === "canonical-entity-control-not-integrated"));
  assert.ok(issues.every((entry) => !/FlowState|akapadi0|5496545d/i.test(JSON.stringify(entry))));
});

test("complete selector read contract and mapped committed artifact pass", () => {
  const issues = analyze({
    manifest: {
      permissions: ["canonical.transaction.read"],
      canonicalDataAccessDeclarations: [transactionDeclaration],
      dataIngressDeclarations: [transactionImport]
    },
    publishManifest: { entryPoints: { "src/plugin.tsx": { file: "assets/plugin.js" } } },
    source: {
      "src/client.tsx": `<label>Client</label><select aria-label="Client"></select>`,
      "src/routes.tsx": `<a href="/transactions">Transactions</a>`,
      "src/data.ts": `export const load = (ctx) => ctx.authenticatedFetch("/transactions?limit=100");`
    },
    dist: { "dist/assets/plugin.js": `x.authenticatedFetch("/transactions?limit=100")` }
  });
  assert.deepEqual(issues, []);
});

test("import-only utility does not create a canonical read obligation", () => {
  assert.deepEqual(analyze({
    manifest: { dataIngressDeclarations: [transactionImport] },
    source: { "src/import.tsx": `<button>Import transactions</button>` }
  }), []);
});

test("unused gateway examples outside the entrypoint graph do not claim canonical data", () => {
  assert.deepEqual(analyzeCanonicalIntegrationContract({
    manifest: {},
    sourceFiles: [
      { path: "src/plugin.tsx", content: `import { App } from "./App"; export const mount = () => App;` },
      { path: "src/App.tsx", content: `export const App = () => null;` },
      { path: "src/lib/gateway.ts", content: `export const getHouseholds = () => authenticatedFetch("/households"); export const getAppData = (recordType) => authenticatedFetch("/app-data?recordType=" + recordType);` }
    ],
    distFiles: [],
    reachableSourceFiles: ["src/plugin.tsx", "src/App.tsx"]
  }), []);
});

test("scenario controls and app-data overlays remain valid app-owned concepts", () => {
  const issues = analyze({
    manifest: {
      dataPortabilityMode: "plannerxchange_portable",
      permissions: ["canonical.transaction.read"],
      canonicalDataAccessDeclarations: [transactionDeclaration]
    },
    source: {
      "src/scenario.tsx": `<label>Scenario client</label><input type="text" />`,
      "src/routes.tsx": `<a href="/transactions">Transactions</a>`,
      "src/data.ts": `ctx.authenticatedFetch("/transactions"); createAppDataRecord({recordType:"transaction_overlays"})`
    },
    dist: { "dist/app.js": `ctx.authenticatedFetch("/transactions")` }
  });
  assert.deepEqual(issues, []);
});

test("canonical facts stored as app-data are rejected while overlays are not", () => {
  const issues = analyze({
    manifest: {
      dataPortabilityMode: "plannerxchange_portable",
      permissions: ["canonical.transaction.read"],
      canonicalDataAccessDeclarations: [transactionDeclaration]
    },
    source: {
      "src/routes.tsx": `<a href="/transactions">Transactions</a>`,
      "src/data.ts": `ctx.authenticatedFetch("/transactions"); createAppDataRecord({recordType:"cashflow_state",status:"draft",schemaVersion:1,payload:{transactionId:transaction.id,date:transaction.date,amount:transaction.amount}})`
    },
    dist: { "dist/app.js": `ctx.authenticatedFetch("/transactions")` }
  });
  assert.ok(issues.some((entry) => entry.code === "canonical-data-shadow-storage"));
});

test("record type names do not matter when app-data stores only builder-owned overlays", () => {
  const issues = analyze({
    manifest: {
      dataPortabilityMode: "plannerxchange_portable",
      permissions: ["canonical.transaction.read"],
      canonicalDataAccessDeclarations: [transactionDeclaration]
    },
    source: {
      "src/routes.tsx": `<a href="/transactions">Transactions</a>`,
      "src/data.ts": `ctx.authenticatedFetch("/transactions"); createAppDataRecord({recordType:"transactions",status:"draft",schemaVersion:1,payload:{transactionId:transaction.id,categoryOverride:"Housing",confirmed:true}})`
    },
    dist: { "dist/app.js": `ctx.authenticatedFetch("/transactions")` }
  });
  assert.deepEqual(issues, []);
});

test("canonical facts copied through a statically assigned payload are rejected", () => {
  const issues = analyze({
    manifest: {
      dataPortabilityMode: "plannerxchange_portable",
      permissions: ["canonical.transaction.read"],
      canonicalDataAccessDeclarations: [transactionDeclaration]
    },
    source: {
      "src/routes.tsx": `<a href="/transactions">Transactions</a>`,
      "src/data.ts": `ctx.authenticatedFetch("/transactions"); const savedState={transactionId:transaction.id,description:transaction.description,amount:transaction.amount}; createAppDataRecord({recordType:"cashflow_state",status:"draft",schemaVersion:1,payload:savedState})`
    },
    dist: { "dist/app.js": `ctx.authenticatedFetch("/transactions")` }
  });
  const finding = issues.find((entry) => entry.code === "canonical-data-shadow-storage");
  assert.ok(finding);
  assert.match(finding.message, /amount/);
  assert.match(finding.message, /description/);
});

test("artifact evidence follows the published entry graph and rejects unrelated chunks", () => {
  const manifest = {
    permissions: ["canonical.transaction.read"],
    canonicalDataAccessDeclarations: [transactionDeclaration]
  };
  const source = { "src/data.ts": `ctx.authenticatedFetch("/transactions")` };
  const publishManifest = { entryPoints: { "src/plugin.tsx": { file: "assets/plugin.js" } } };
  const unrelated = analyze({
    manifest, source, publishManifest,
    dist: { "dist/assets/plugin.js": `export const mount=()=>{};`, "dist/assets/unused.js": `fetch("/transactions")` }
  });
  assert.equal(unrelated[0]?.code, "canonical-data-build-artifact-missing");
  const mapped = analyze({
    manifest, source, publishManifest,
    dist: { "dist/assets/plugin.js": `export {load} from "./data.js"`, "dist/assets/data.js": `fetch("/transactions")` }
  });
  assert.deepEqual(mapped, []);
});

test("every governed category has an exact read permission and selection scope", () => {
  assert.deepEqual(CANONICAL_INTEGRATION_CATEGORIES.map((entry) => entry.category), [
    "households", "clients", "accounts", "positions", "transactions", "cost_basis", "securities", "models", "sleeves"
  ]);
  assert.ok(CANONICAL_INTEGRATION_CATEGORIES.every((entry) => entry.permission.startsWith("canonical.") && entry.selectionEntity));
});
