import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { analyzeImportSessionContract, CANONICAL_IMPORT_ENTITY_CATALOG } from "./import-session-contract.mjs";

const declaration = {
  id: "transactions-import",
  source: "csv_upload",
  purpose: "Import transactions through PlannerXchange.",
  dataClasses: ["transactions", "account_data"],
  target: "px_import_session",
  supportedModes: ["canonical_store"],
  canonicalEntityHints: ["transaction", "account"]
};

function analyze({ manifest = {}, source = {}, dist = {} } = {}) {
  return analyzeImportSessionContract({
    manifest,
    sourceFiles: Object.entries(source).map(([path, content]) => ({ path, content })),
    distFiles: Object.entries(dist).map(([path, content]) => ({ path, content }))
  });
}

test("accepts an exact declaration with matching source and build calls", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/ImportPage.tsx": `export const ImportPage = ({ ctx }) => <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" })}>Import Data</button>;`
    },
    dist: {
      "dist/assets/plugin.js": `e.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})`
    }
  });
  assert.deepEqual(issues, []);
});

test("accepts every catalog entity with its exact required data class and entrypoint label", () => {
  for (const [entityType, requiredDataClass, aliases] of CANONICAL_IMPORT_ENTITY_CATALOG) {
    const id = `${entityType}-import`;
    const issues = analyze({
      manifest: { dataIngressDeclarations: [{ ...declaration, id, dataClasses: [requiredDataClass], canonicalEntityHints: [entityType] }] },
      source: { [`src/${entityType}.tsx`]: `export const Page = ({ ctx }) => <button onClick={() => ctx.openDataImportSession({ declarationId: "${id}", entityType: "${entityType}" })}>Import ${aliases[0]}</button>;` },
      dist: { [`dist/${entityType}.js`]: `x.openDataImportSession({declarationId:"${id}",mode:"canonical_store",entityType:"${entityType}"})` }
    });
    assert.deepEqual(issues, [], entityType);
  }
});

test("catalog retains exact CSV schemas and parent resolution rules", () => {
  const byEntity = new Map(CANONICAL_IMPORT_ENTITY_CATALOG.map(([entityType, , , rules]) => [entityType, rules]));
  assert.deepEqual(byEntity.get("model").csvColumns, ["name", "description", "asset_manager", "status", "visibility"]);
  assert.deepEqual(byEntity.get("model_holding").parentEntityTypes, ["model", "security"]);
  assert.equal(byEntity.get("model_holding").resolvesSecurities, true);
  assert.deepEqual(byEntity.get("sleeve_allocation").csvColumns, ["sleeve_id", "sleeve_name", "model_id", "model_name", "weight", "tax_setting"]);
  assert.deepEqual(byEntity.get("sleeve_allocation").parentEntityTypes, ["sleeve", "model"]);
});

test("starter type shim stays in parity with the preflight catalog", () => {
  const source = readFileSync(new URL("../src/plannerxchange.ts", import.meta.url), "utf8");
  for (const [entityType, requiredDataClass] of CANONICAL_IMPORT_ENTITY_CATALOG) {
    assert.match(source, new RegExp(`\\|\\s+"${entityType}"`), entityType);
    assert.match(source, new RegExp(`\\|\\s+"${requiredDataClass}"`), requiredDataClass);
  }
  for (const category of ["securities", "models", "sleeves"]) assert.match(source, new RegExp(`\\|\\s+"${category}"`));
  for (const selector of ["firm", "model", "sleeve"]) assert.match(source, new RegExp(`\\|\\s+"${selector}"`));
});

test("an entity-specific entrypoint cannot be satisfied by a different declaration", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/ImportModels.tsx": `export const ImportModels = ({ ctx }) => <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import" })}>Import Models</button>;`
    },
    dist: {
      "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})`
    }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), true);
});

test("checks multiple entity-specific entrypoints in one source file independently", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/Imports.tsx": `export const Imports = ({ ctx }) => <><button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import" })}>Import Transactions</button>\n<button>Import Models</button></>;`
    },
    dist: {
      "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})`
    }
  });
  assert.equal(issues.filter((entry) => entry.code === "import-entrypoint-not-integrated").length, 1);
});

test("rejects old and misspelled ingress enum values", () => {
  const issues = analyze({
    manifest: {
      dataIngressDeclarations: [
        {
          ...declaration,
          source: "csv",
          target: ["px", "core", "import", "handoff"].join("_"),
          dataClasses: ["financial_transactions"]
        }
      ]
    }
  });
  assert.equal(issues.filter((entry) => entry.code === "import-session-request-contract-invalid").length >= 3, true);
});

test("requires every declaration in source and committed build output", () => {
  const issues = analyze({ manifest: { dataIngressDeclarations: [declaration] } });
  assert.equal(issues.some((entry) => entry.code === "import-session-declaration-usage-missing"), true);
  assert.equal(issues.some((entry) => entry.code === "import-session-build-artifact-missing"), true);
});

test("rejects calls without a matching declaration and removed request properties", () => {
  const issues = analyze({
    source: {
      "src/import.ts": `ctx.openDataImportSession({ declarationId: "missing", returnToApp: true, metadata: {} });`
    }
  });
  assert.equal(issues.filter((entry) => entry.code === "import-session-request-contract-invalid").length >= 2, true);
});

test("validates multiple declaration IDs independently", () => {
  const second = { ...declaration, id: "accounts-import", dataClasses: ["account_data"], canonicalEntityHints: ["account"] };
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration, second] },
    source: {
      "src/import.ts": `ctx.openDataImportSession({ declarationId: "transactions-import" });`
    },
    dist: {
      "dist/assets/plugin.js": `e.openDataImportSession({declarationId:"transactions-import"})`
    }
  });
  assert.equal(
    issues.some((entry) => entry.code === "import-session-declaration-usage-missing" && entry.message.includes("accounts-import")),
    true
  );
});

test("rejects source-only calls that disappear from the build", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/import.ts": `ctx.openDataImportSession({ declarationId: "transactions-import" });`
    }
  });
  assert.equal(issues.some((entry) => entry.code === "import-session-build-artifact-missing"), true);
});

test("reproduces the FlowState terminal import page", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/ImportData.tsx": `export function ImportData() { return <section><h1>Data Import</h1><p>Transaction import is managed by PlannerXchange. Use the PlannerXchange data connector to import bank and credit card statements for this household.</p><p>Once PlannerXchange imports the data, it will appear automatically in Cashflow Planning, Transactions, and Reports.</p></section>;`
    }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), true);
});

test("accepts a statically traceable FlowState-style wrapper", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/plugin.tsx": `import App from "./App"; import { initPxImport } from "./lib/px-import"; export function mount(context) { initPxImport(context?.openDataImportSession); return App; }`,
      "src/App.tsx": `import ImportPage from "./pages/import"; export default function App() { return <Route path="/import" element={<ImportPage />} />; }`,
      "src/pages/import.tsx": `import { launchImport } from "../lib/px-import"; export default function ImportPage() { return <button onClick={launchImport}>Import Data</button>; }`,
      "src/lib/px-import.ts": `const IMPORT_ID = "transactions-import"; let _openDataImportSession; export function initPxImport(openDataImportSession) { _openDataImportSession = openDataImportSession; } export function launchImport() { return _openDataImportSession({ declarationId: IMPORT_ID, mode: "canonical_store" }); }`
    },
    dist: {
      "dist/assets/plugin.js": `const i="transactions-import",m="canonical_store";e.openDataImportSession({declarationId:i,mode:m})`
    }
  });
  assert.deepEqual(issues, []);
});

test("does not let unreachable helper code satisfy an import page", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/ImportPage.tsx": `export function ImportPage() { return <button>Import Data</button>; }`,
      "src/dead-import.ts": `ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" });`
    },
    dist: {
      "dist/assets/plugin.js": `e.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})`
    }
  });
  assert.equal(
    issues.some((entry) => entry.code === "import-entrypoint-not-integrated"),
    true
  );
});

test("rejects removed fields in hand-written import request types", () => {
  const issues = analyze({
    source: {
      "src/plannerxchange.ts": `export interface AppDataImportSessionRequest { declarationId: string; returnToApp?: boolean; metadata?: Record<string, unknown>; }`
    }
  });
  assert.equal(
    issues.some(
      (entry) =>
        entry.code === "import-session-request-contract-invalid" &&
        entry.message.includes("returnToApp")
    ),
    true
  );
});

test("distinguishes spreadsheet export from actual spreadsheet ingress", () => {
  const exportIssues = analyze({
    source: {
      "src/export.ts": `const blob = new Blob([csv]); const link = document.createElement("a"); link.download = "transactions.xlsx"; XLSX.write(workbook);`
    }
  });
  assert.equal(
    exportIssues.some((entry) => entry.code === "undeclared-file-ingress"),
    false
  );

  const ingressIssues = analyze({
    source: {
      "src/import.ts": `const workbook = XLSX.read(buffer);`
    }
  });
  assert.equal(
    ingressIssues.some((entry) => entry.code === "undeclared-file-ingress"),
    true
  );
});
