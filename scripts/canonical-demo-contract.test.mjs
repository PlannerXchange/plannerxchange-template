import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const preflightPath = fileURLToPath(new URL("./preflight.mjs", import.meta.url));
const checklist = {
  version: 1,
  checks: [{
    id: "manifest-canonical-demo-usage",
    severity: "error",
    title: "Canonical Demo usage",
    description: "Validate the pinned field catalog.",
    type: "manifest-canonical-demo-usage"
  }]
};

function run(manifest, { source, dist } = {}) {
  const root = mkdtempSync(join(tmpdir(), "px-demo-preflight-"));
  try {
    writeFileSync(join(root, "plannerxchange.preflight.json"), JSON.stringify(checklist));
    writeFileSync(join(root, "plannerxchange.app.json"), JSON.stringify(manifest));
    if (source) {
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "plugin.ts"), source);
    }
    if (dist) {
      mkdirSync(join(root, "dist"), { recursive: true });
      writeFileSync(join(root, "dist", "plugin.js"), dist);
    }
    return spawnSync(process.execPath, [preflightPath], {
      cwd: root,
      encoding: "utf8"
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("preflight accepts exact canonical Demo declarations", () => {
  const result = run({
    permissions: ["canonical.transaction.read"],
    canonicalDataUsageDeclarations: [{
      id: "transaction-table",
      catalogVersion: "px_canonical_demo_v1",
      category: "transactions",
      object: "transaction",
      fields: [
        { path: "date", uses: ["display", "sort"] },
        { path: "amount", uses: ["display", "calculation"] }
      ]
    }]
  }, {
    source: `if (ctx.runtimeMode === "public_demo") createPlannerXchangeDemoDataClient({ apiBaseUrl: ctx.apiBaseUrl, scenario: "standard", catalogVersion: "px_canonical_demo_v1" });`,
    dist: `createPlannerXchangeDemoDataClient({scenario:"standard",catalogVersion:"px_canonical_demo_v1"})`
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("preflight rejects declarations without the public Demo API and committed artifact", () => {
  const result = run({
    permissions: ["canonical.transaction.read"],
    canonicalDataUsageDeclarations: [{
      id: "transaction-table",
      catalogVersion: "px_canonical_demo_v1",
      category: "transactions",
      object: "transaction",
      fields: [{ path: "amount", uses: ["display"] }]
    }]
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /public \/canonical-demo API/);
});

test("preflight rejects custom fields, mismatched objects, and missing exact permissions", () => {
  const result = run({
    permissions: ["canonical.account.read"],
    canonicalDataUsageDeclarations: [{
      id: "bad-table",
      catalogVersion: "future-version",
      category: "accounts",
      object: "transaction",
      fields: [{ path: "customFields.favorite", uses: ["invented"] }]
    }]
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /px_canonical_demo_v1/);
  assert.match(result.stdout, /belongs to transactions/);
  assert.match(result.stdout, /requires canonical\.transaction\.read/);
  assert.match(result.stdout, /unsupported or duplicate field/);
});
