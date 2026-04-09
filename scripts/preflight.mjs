#!/usr/bin/env node

/**
 * PlannerXchange Preflight Checker
 *
 * Reads plannerxchange.preflight.json and runs each check against the local
 * project. Run with: node scripts/preflight.mjs
 *
 * Exit code 1 if any "error" severity check fails.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// Try to load a glob implementation. Node 22+ has globSync in node:fs,
// but older versions need the "glob" npm package or a manual walk.
let glob = null;
try {
  const mod = await import("glob");
  glob = mod.globSync ?? mod.default?.globSync ?? null;
} catch {
  // No glob package available — use manual walk below.
}

const ROOT = resolve(process.cwd());
const CHECKLIST_PATH = join(ROOT, "plannerxchange.preflight.json");

if (!existsSync(CHECKLIST_PATH)) {
  console.error("❌  plannerxchange.preflight.json not found in project root.");
  process.exit(1);
}

const checklist = JSON.parse(readFileSync(CHECKLIST_PATH, "utf-8"));
const checks = checklist.checks ?? [];

let errors = 0;
let warnings = 0;

// ---- Helpers ---------------------------------------------------------------

function resolveGlob(patterns) {
  if (!glob) {
    // crude fallback: walk src/
    return walkDir(join(ROOT, "src"));
  }
  const files = new Set();
  for (const p of patterns) {
    for (const f of glob(p, { cwd: ROOT, nodir: true })) {
      files.add(join(ROOT, f));
    }
  }
  return [...files];
}

// ---- Helpers ---------------------------------------------------------------

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules") continue;
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function matchesExtension(filePath, includePatterns) {
  // Extract extensions from patterns like "src/**/*.{ts,tsx,js,jsx,json}"
  const exts = new Set();
  for (const p of includePatterns) {
    const m = p.match(/\.\{([^}]+)\}/);
    if (m) {
      for (const e of m[1].split(",")) exts.add(`.${e.trim()}`);
    }
    const m2 = p.match(/\*(\.[a-z]+)$/i);
    if (m2) exts.add(m2[1]);
  }
  if (exts.size === 0) return true;
  for (const ext of exts) {
    if (filePath.endsWith(ext)) return true;
  }
  return false;
}

function report(check, pass, detail) {
  const icon = pass ? "✅" : check.severity === "error" ? "❌" : "⚠️ ";
  const tag = pass ? "PASS" : check.severity.toUpperCase();
  console.log(`${icon}  [${tag}] ${check.title}`);
  if (!pass && detail) {
    console.log(`      ${detail}`);
  }
  if (!pass) {
    if (check.severity === "error") errors++;
    else warnings++;
  }
}

// ---- Check runners ---------------------------------------------------------

function runGrepCheck(check) {
  const include = check.include ?? ["src/**/*.{ts,tsx,js,jsx}"];
  const excludeFiles = (check.exclude ?? [])
    .filter((e) => !e.includes("**"))
    .map((e) => resolve(ROOT, e));

  let files;
  try {
    files = resolveGlob(include);
  } catch {
    files = walkDir(join(ROOT, "src"));
  }
  files = files
    .filter((f) => matchesExtension(f, include))
    .filter((f) => !excludeFiles.some((ex) => f === ex || f.replace(/\\/g, "/") === ex.replace(/\\/g, "/")));

  const re = new RegExp(check.pattern, "gi");
  const hits = [];

  for (const fp of files) {
    const content = readFileSync(fp, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const rel = fp.replace(ROOT + "/", "").replace(ROOT + "\\", "");
        hits.push(`${rel}:${i + 1}`);
      }
      re.lastIndex = 0;
    }
  }

  if (hits.length === 0) {
    report(check, true);
  } else {
    report(check, false, `Found in: ${hits.slice(0, 5).join(", ")}${hits.length > 5 ? ` (+${hits.length - 5} more)` : ""}`);
  }
}

function runManifestFieldCheck(check) {
  const manifestPath = join(ROOT, "plannerxchange.app.json");
  if (!existsSync(manifestPath)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const val = manifest[check.field];

  let pass = false;
  if (check.check === "non-empty") {
    pass = typeof val === "string" && val.trim().length > 0;
  } else if (check.check === "non-empty-array") {
    pass = Array.isArray(val) && val.length > 0;
  }

  report(check, pass, pass ? undefined : `Field "${check.field}" is missing or empty`);
}

function runPathExistsCheck(check) {
  const target = join(ROOT, check.path);
  const pass = existsSync(target);
  report(check, pass, pass ? undefined : `Path not found: ${check.path}`);
}

// ---- Main ------------------------------------------------------------------

console.log(`\nPlannerXchange Preflight — ${checks.length} checks\n`);

for (const check of checks) {
  switch (check.type) {
    case "grep":
      runGrepCheck(check);
      break;
    case "manifest-field":
      runManifestFieldCheck(check);
      break;
    case "path-exists":
      runPathExistsCheck(check);
      break;
    default:
      console.log(`⚠️   [SKIP] Unknown check type: ${check.type}`);
  }
}

console.log(`\n--- Summary: ${errors} error(s), ${warnings} warning(s) ---\n`);

if (errors > 0) {
  console.log("Preflight failed. Fix error-level issues before publishing.");
  process.exit(1);
} else if (warnings > 0) {
  console.log("Preflight passed with warnings. Review before publishing.");
} else {
  console.log("Preflight passed. Ready to publish.");
}
