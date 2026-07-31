import assert from "node:assert/strict";
import test from "node:test";

import { analyzeImportSessionContract } from "./import-session-contract.mjs";

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
  const second = { ...declaration, id: "accounts-import", dataClasses: ["account_data"] };
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
