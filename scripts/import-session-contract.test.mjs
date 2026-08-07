import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { analyzeImportSessionContract, buildReviewSourceReachability, CANONICAL_IMPORT_ENTITY_CATALOG } from "./import-session-contract.mjs";

const declaration = {
  id: "transactions-import",
  source: "csv_upload",
  purpose: "Import transactions through PlannerXchange.",
  dataClasses: ["transactions", "account_data"],
  target: "px_import_session",
  supportedModes: ["canonical_store"],
  canonicalEntityHints: ["transaction", "account"]
};

function analyze({ manifest = {}, publishManifest, source = {}, dist = {} } = {}) {
  return analyzeImportSessionContract({
    manifest,
    publishManifest,
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

test("keeps same-line action use when excluding an unresolved import statement", () => {
  const sourceFiles = [
    { path: "tsconfig.json", content: JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*", "alternate/*"] } } }) },
    { path: "src/plugin.ts", content: `import { load } from "@/lib/store"; export function mount(api){return load(api)}` },
    { path: "src/lib/store.ts", content: `export function load(api){return api.listAppData()}` },
    { path: "alternate/lib/store.ts", content: `export function load(){return []}` }
  ];
  const result = buildReviewSourceReachability({ sourceFiles, entrypointFiles: ["src/plugin.ts"] });
  assert.match(result.relevantDiagnostics.join(" "), /Ambiguous local import alias/);
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

test("rejects a route-linked informational terminal import page", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/App.tsx": `import "./styles.css"; import { ImportData } from "./ImportData"; export function App() { return <Route path="/import" element={<ImportData />} />; }`,
      "src/ImportData.tsx": `export function ImportData() { return <section><h1>Data Import</h1><p>Transaction import is managed by PlannerXchange. Use the PlannerXchange data connector to import bank and credit card statements for this household.</p><p>Once PlannerXchange imports the data, it will appear automatically in Cashflow Planning, Transactions, and Reports.</p></section>;`
    }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), true);
  assert.equal(issues.some((entry) => entry.code === "import-contract-analysis-indeterminate"), false);
});

test("accepts a statically traceable runtime wrapper", () => {
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

test("ignores language imports, helper names, comments, and non-rendered import strings", () => {
  const issues = analyze({
    source: {
      "src/App.tsx": `import ImportPage from "./ImportPage"; export { ImportPage } from "./ImportPage";`,
      "src/helpers.ts": `// Import Transactions\nexport function importTransactions() { throw new Error("Import transactions failed"); }`,
      "src/report.ts": `const message = "Import Accounts when the report is ready";`,
      "src/info.tsx": `export const Budget = () => <p>Import transactions or ask the assistant to start a budget.</p>;`,
      "src/string.tsx": `export const markup = "<button>Import Accounts</button>";`
    }
  });
  assert.deepEqual(issues, []);
});

test("accepts a production-shaped configured-alias journey through relative tsconfig extends", () => {
  const distantMinifiedAlias = `let r;function mount(c){r=c.openDataImportSession}${"const genericImportLabel='import';".repeat(2_000)}const i="transactions-import",m="canonical_store";r({declarationId:i,mode:m})`;
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "tsconfig.base.json": `{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }`,
      "tsconfig.json": `{ "extends": "./tsconfig.base.json", "compilerOptions": { /* JSONC */ } }`,
      "src/plugin.tsx": `import App from "@/App"; import { initPxImport } from "@/lib/px-import"; export function mount(context) { initPxImport(context?.openDataImportSession); return <App />; }`,
      "src/App.tsx": `import "@/styles/global.css";\nimport Home from "@/pages/home";\nimport {\n  default as ImportPage\n} from "@/pages/import";\nexport default function App() { return (\n<>\n<Route path="/" component={Home} />\n<Route\n path="/clients/:clientId/import"\n component={ImportPage}\n/>\n</>\n); }`,
      "src/navigation.tsx": `import logo from "@/assets/app-logo.svg";\nexport const nav = { label: "Import Data", to: "/clients/\${clientId}/import" };`,
      "src/budget.tsx": `export const Budget = () => <p>Import transactions or ask the assistant to start a budget.</p>;`,
      "src/pages/home.tsx": `export default function Home() { return null; }`,
      "src/pages/import.tsx": `import {\n launchImport as startCanonicalImport\n} from "@/lib/px-import";\nexport default function ImportPage() { return <button onClick={startCanonicalImport}>Import Transactions</button>; }`,
      "src/lib/px-import.ts": `const IMPORT_ID = "transactions-import"; let launch; export function initPxImport(openDataImportSession) { launch = openDataImportSession; } export function launchImport() { return launch({ declarationId: IMPORT_ID, mode: "canonical_store" }); }`
    },
    dist: {
      "dist/assets/plugin.js": distantMinifiedAlias
    }
  });
  assert.deepEqual(issues, []);
});

test("links parameterized navigation destinations to import routes", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/Nav.tsx": "export function Nav({ navigate, id }) { return <button onClick={() => navigate(`/clients/${id}/import`)}>Import Transactions</button>; }",
      "src/App.tsx": `import ImportPage from "./ImportPage"; export function App() { return <Route path="/clients/:clientId/import" element={<ImportPage />} />; }`,
      "src/ImportPage.tsx": `export default function ImportPage({ ctx }) { return <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" })}>Import Data</button>; }`
    },
    dist: { "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})` }
  });
  assert.deepEqual(issues, []);
});

test("traces literal lazy imports and require bindings", () => {
  for (const appSource of [
    `const ImportPage = lazy(() => import("./ImportPage")); export function App() { return <Route path="/import" element={<ImportPage />} />; }`,
    `const ImportPage = require("./ImportPage"); export function App() { return <Route path="/import" element={<ImportPage />} />; }`
  ]) {
    const issues = analyze({
      manifest: { dataIngressDeclarations: [declaration] },
      source: {
        "src/App.tsx": appSource,
        "src/ImportPage.tsx": `export default function ImportPage({ ctx }) { return <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" })}>Import Data</button>; }`
      },
      dist: { "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})` }
    });
    assert.deepEqual(issues, [], appSource);
  }
});

test("does not let an unrelated helper in the same file satisfy rendered import UI", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "src/ImportPage.tsx": `export function ImportPage() { return <button>Import Data</button>; } export function unused(ctx) { return ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" }); }`
    },
    dist: { "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})` }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), true);
});

test("reports ambiguous configured aliases as indeterminate instead of a false app gap", () => {
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source: {
      "tsconfig.json": `{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/a/*", "src/b/*"] } } }`,
      "src/App.tsx": `import { launchImport } from "@/import"; export function App() { return <button onClick={launchImport}>Import Data</button>; }`,
      "src/a/import.ts": `export const launchImport = (ctx) => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" });`,
      "src/b/import.ts": `export const launchImport = (ctx) => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" });`
    },
    dist: { "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})` }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), false);
  assert.equal(issues.some((entry) => entry.code === "import-contract-analysis-indeterminate"), true);
});

test("treats bounded graph traversal as indeterminate", () => {
  const source = {
    "src/ImportPage.tsx": `import { step1 } from "./step1"; export function ImportPage() { return <button onClick={step1}>Import Data</button>; }`
  };
  for (let index = 1; index <= 9; index += 1) {
    source[`src/step${index}.ts`] = index === 9
      ? `export function step9(ctx) { return ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" }); }`
      : `import { step${index + 1} } from "./step${index + 1}"; export function step${index}() { return step${index + 1}(); }`;
  }
  const issues = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    source,
    dist: { "dist/plugin.js": `ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})` }
  });
  assert.equal(issues.some((entry) => entry.code === "import-entrypoint-not-integrated"), false);
  assert.equal(issues.some((entry) => entry.code === "import-contract-analysis-indeterminate"), true);
});

test("follows committed entry chunks transitively and keeps artifact evidence declaration-specific", () => {
  const publishManifest = { entryPoints: { "src/plugin.tsx": { file: "assets/plugin.js" } } };
  const passing = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    publishManifest,
    source: {
      "src/ImportPage.tsx": `export const ImportPage = ({ ctx }) => <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" })}>Import Data</button>;`
    },
    dist: {
      "dist/assets/plugin.js": `import{a}from"./import-chunk.js";export{a as mount};`,
      "dist/assets/import-chunk.js": `${"const genericImportLabel='import';".repeat(500)}ctx.openDataImportSession({declarationId:"transactions-import",mode:"canonical_store"})`,
      "dist/assets/unreachable.js": `ctx.openDataImportSession({declarationId:"other-import",mode:"canonical_store"})`
    }
  });
  assert.deepEqual(passing, []);

  const contaminated = analyze({
    manifest: { dataIngressDeclarations: [declaration] },
    publishManifest,
    source: {
      "src/ImportPage.tsx": `export const ImportPage = ({ ctx }) => <button onClick={() => ctx.openDataImportSession({ declarationId: "transactions-import", mode: "canonical_store" })}>Import Data</button>;`
    },
    dist: {
      "dist/assets/plugin.js": `const marker="transactions-import";ctx.openDataImportSession({declarationId:"different-import",mode:"canonical_store"})`
    }
  });
  assert.equal(contaminated.some((entry) => entry.code === "import-session-build-artifact-missing"), true);
});
