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
import { analyzeImportSessionContract } from "./import-session-contract.mjs";

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
const MANIFEST_PATH = join(ROOT, "plannerxchange.app.json");
const CHECKLIST_PATH = join(ROOT, "plannerxchange.preflight.json");

if (!existsSync(CHECKLIST_PATH)) {
  console.error("❌  plannerxchange.preflight.json not found in project root.");
  process.exit(1);
}

const checklist = JSON.parse(readFileSync(CHECKLIST_PATH, "utf-8"));
const checks = checklist.checks ?? [];
let manifestCache = null;

let errors = 0;
let warnings = 0;

// ---- Helpers ---------------------------------------------------------------

function resolveGlob(patterns) {
  const resolvedPatterns = patterns.map((pattern) => resolveChecklistPath(pattern));
  const boundary = getAppBoundary();
  const includesDistRoot = resolvedPatterns.some(
    (pattern) => pattern === boundary.distRoot || pattern.startsWith(`${boundary.distRoot}/`)
  );

  if (!glob) {
    return walkDir(ROOT, { includeDist: includesDistRoot }).filter((fp) =>
      matchesAnyPattern(toRelativePath(fp), resolvedPatterns)
    );
  }
  const files = new Set();
  for (const p of resolvedPatterns) {
    for (const f of glob(p, { cwd: ROOT, nodir: true })) {
      files.add(join(ROOT, f));
    }
  }
  return [...files];
}

// ---- Helpers ---------------------------------------------------------------

function walkDir(dir, options = {}) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    if ([".git", "node_modules"].includes(entry) || (entry === "dist" && !options.includeDist)) {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkDir(full, options));
    } else {
      results.push(full);
    }
  }
  return results;
}

function toRelativePath(filePath) {
  return filePath.replace(ROOT + "/", "").replace(ROOT + "\\", "").replace(/\\/g, "/");
}

function normalizeRepoRelativePath(value, fallback) {
  const rawValue = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = rawValue
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized === ".") {
    return ".";
  }

  if (
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    /^[a-z]:\//i.test(normalized)
  ) {
    throw new Error(`'${rawValue}' must be a repo-relative path inside the repository.`);
  }

  return normalized;
}

function joinRepoRelativePath(base, child) {
  const normalizedChild = normalizeRepoRelativePath(child, ".");

  if (normalizedChild === ".") {
    return base;
  }

  return base === "." ? normalizedChild : `${base}/${normalizedChild}`;
}

function readManifest() {
  if (manifestCache) {
    return manifestCache;
  }

  if (!existsSync(MANIFEST_PATH)) {
    return null;
  }

  manifestCache = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  return manifestCache;
}

function getAppBoundary() {
  const manifest = readManifest() ?? {};
  const appRoot = normalizeRepoRelativePath(manifest.appRoot, ".");
  const distRoot = normalizeRepoRelativePath(
    manifest.distRoot,
    appRoot === "." ? "dist" : `${appRoot}/dist`
  );
  const entryPoint = normalizeRepoRelativePath(manifest.entryPoint, "src/plugin.tsx");
  const workspacePackage =
    typeof manifest.workspacePackage === "string" && manifest.workspacePackage.trim()
      ? manifest.workspacePackage.trim()
      : null;

  return {
    appRoot,
    distRoot,
    entryPoint,
    workspacePackage,
    pluginSourcePath: joinRepoRelativePath(appRoot, entryPoint),
    publishManifestPath: `${distRoot}/plannerxchange.publish.json`,
    buildProvenancePath: `${distRoot}/plannerxchange.build-provenance.json`
  };
}

function resolveChecklistPath(pathTemplate) {
  const boundary = getAppBoundary();
  return String(pathTemplate)
    .replaceAll("$appRoot", boundary.appRoot)
    .replaceAll("$distRoot", boundary.distRoot)
    .replaceAll("$entryPoint", boundary.entryPoint);
}

function globToRegExp(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  let out = "^";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === "*" && next === "*") {
      if (normalized[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else if (ch === "{") {
      const end = normalized.indexOf("}", i);
      if (end === -1) {
        out += "\\{";
      } else {
        const options = normalized
          .slice(i + 1, end)
          .split(",")
          .map((part) => part.trim().replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
          .join("|");
        out += `(?:${options})`;
        i = end;
      }
    } else {
      out += ch.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  out += "$";
  return new RegExp(out);
}

function matchesAnyPattern(relPath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(relPath));
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
  const resolvedInclude = include.map((pattern) => resolveChecklistPath(pattern));
  const exclude = (check.exclude ?? []).map((pattern) => resolveChecklistPath(pattern));
  const boundary = getAppBoundary();
  const includesDistRoot = resolvedInclude.some(
    (pattern) => pattern === boundary.distRoot || pattern.startsWith(`${boundary.distRoot}/`)
  );

  let files;
  try {
    files = resolveGlob(include);
  } catch {
    files = walkDir(ROOT, { includeDist: includesDistRoot }).filter((fp) =>
      matchesAnyPattern(toRelativePath(fp), resolvedInclude)
    );
  }
  files = files
    .filter((f) => matchesExtension(f, resolvedInclude))
    .filter((f) => !matchesAnyPattern(toRelativePath(f), exclude));

  const re = new RegExp(check.pattern, "gi");
  const hits = [];

  for (const fp of files) {
    const content = readFileSync(fp, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const rel = toRelativePath(fp);
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
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }
  const manifest = readManifest();
  const val = manifest[check.field];

  let pass = false;
  if (check.check === "non-empty") {
    pass = typeof val === "string" && val.trim().length > 0;
  } else if (check.check === "non-empty-array") {
    pass = Array.isArray(val) && val.length > 0;
  }

  report(check, pass, pass ? undefined : `Field "${check.field}" is missing or empty`);
}

function runManifestBoundaryCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  try {
    const boundary = getAppBoundary();
    const pluginSourcePath = join(ROOT, boundary.pluginSourcePath);

    if (!existsSync(pluginSourcePath) || !statSync(pluginSourcePath).isFile()) {
      report(
        check,
        false,
        `entryPoint "${boundary.entryPoint}" was not found under app folder "${boundary.appRoot}". Expected ${boundary.pluginSourcePath}.`
      );
      return;
    }

    report(check, true);
  } catch (error) {
    report(check, false, error instanceof Error ? error.message : "Invalid app folder or build output path.");
  }
}

function runManifestUnsupportedFieldsCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  const manifest = readManifest() ?? {};
  const fields = Array.isArray(check.fields) ? check.fields : [];
  const unsupported = fields.filter((field) =>
    Object.prototype.hasOwnProperty.call(manifest, field)
  );

  report(
    check,
    unsupported.length === 0,
    unsupported.length > 0
      ? `Remove unsupported manifest field(s): ${unsupported.join(", ")}. Use visibility, dataPortabilityMode, permissions, egressDeclarations, and dataIngressDeclarations instead.`
      : undefined
  );
}

const CANONICAL_PERMISSION_CONTRACT = {
  "canonical.household.read": ["households", "read"],
  "canonical.household.write": ["households", "write"],
  "canonical.client.summary.read": ["clients", "read"],
  "canonical.client.sensitive.read": ["clients", "read"],
  "canonical.client.write": ["clients", "write"],
  "canonical.account.read": ["accounts", "read"],
  "canonical.account.write": ["accounts", "write"],
  "canonical.position.read": ["positions", "read"],
  "canonical.transaction.read": ["transactions", "read"],
  "canonical.cost_basis.read": ["cost_basis", "read"]
};

function runManifestCanonicalDataAccessCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  const manifest = readManifest() ?? {};
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const declarations = Array.isArray(manifest.canonicalDataAccessDeclarations)
    ? manifest.canonicalDataAccessDeclarations
    : [];
  const issues = [];

  for (const permission of permissions) {
    const contract = CANONICAL_PERMISSION_CONTRACT[permission];
    if (!contract) continue;
    const [category, operation] = contract;
    const declaration = declarations.find((entry) => entry?.category === category);
    if (!declaration || !Array.isArray(declaration.scopes) || !declaration.scopes.includes(operation)) {
      issues.push(`${permission} requires ${category}:${operation} in canonicalDataAccessDeclarations`);
    }
  }

  for (const declaration of declarations) {
    if (!declaration || typeof declaration.category !== "string" || !Array.isArray(declaration.scopes)) {
      issues.push("canonicalDataAccessDeclarations contains an incomplete item");
      continue;
    }
    for (const operation of declaration.scopes) {
      const matchingPermission = permissions.some((permission) => {
        const contract = CANONICAL_PERMISSION_CONTRACT[permission];
        return contract?.[0] === declaration.category && contract?.[1] === operation;
      });
      if (!matchingPermission) {
        issues.push(`${declaration.category}:${operation} has no matching canonical permission`);
      }
    }
  }

  report(
    check,
    issues.length === 0,
    issues.length > 0 ? issues.slice(0, 6).join("; ") : undefined
  );
}

function runImportSessionContractCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  const boundary = getAppBoundary();
  const sourcePrefix = boundary.appRoot === "." ? "src/" : `${boundary.appRoot}/src/`;
  const distPrefix = `${boundary.distRoot}/`;
  const reviewedFiles = walkDir(ROOT, { includeDist: true })
    .map((filePath) => ({ filePath, path: toRelativePath(filePath) }))
    .filter(
      (file) =>
        (file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)) ||
        (file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path))
    )
    .map((file) => ({
      path: file.path,
      content: readFileSync(file.filePath, "utf-8")
    }));
  const sourceFiles = reviewedFiles.filter(
    (file) => file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)
  );
  const distFiles = reviewedFiles.filter(
    (file) => file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path)
  );
  const issues = analyzeImportSessionContract({
    manifest: readManifest() ?? {},
    sourceFiles,
    distFiles
  });

  report(
    check,
    issues.length === 0,
    issues.length > 0
      ? issues.slice(0, 8).map((entry) => `${entry.code}: ${entry.message}`).join("; ")
      : undefined
  );
}

function runBuildProvenanceBoundaryCheck(check) {
  const boundary = getAppBoundary();
  const provenancePath = join(ROOT, boundary.buildProvenancePath);

  if (!existsSync(provenancePath)) {
    report(check, false, `Path not found: ${boundary.buildProvenancePath}`);
    return;
  }

  try {
    const provenance = JSON.parse(readFileSync(provenancePath, "utf-8"));
    const appRoot = normalizeRepoRelativePath(provenance.appRoot, ".");
    const distRoot = normalizeRepoRelativePath(provenance.distRoot, appRoot === "." ? "dist" : `${appRoot}/dist`);
    const builderSource =
      typeof provenance.builder?.source === "string" ? normalizeRepoRelativePath(provenance.builder.source, "") : "";

    if (appRoot !== boundary.appRoot) {
      report(check, false, `Build provenance appRoot is "${appRoot}", expected "${boundary.appRoot}".`);
      return;
    }

    if (distRoot !== boundary.distRoot) {
      report(check, false, `Build provenance distRoot is "${distRoot}", expected "${boundary.distRoot}".`);
      return;
    }

    if (builderSource && builderSource !== boundary.buildProvenancePath) {
      report(check, false, `Build provenance builder.source is "${builderSource}", expected "${boundary.buildProvenancePath}".`);
      return;
    }

    report(check, true);
  } catch (error) {
    report(check, false, error instanceof Error ? error.message : "Build provenance is not valid JSON.");
  }
}

function runPathExistsCheck(check) {
  const resolvedPath = resolveChecklistPath(check.path);
  const target = join(ROOT, resolvedPath);
  const pass = existsSync(target);
  report(check, pass, pass ? undefined : `Path not found: ${resolvedPath}`);
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
    case "manifest-boundary":
      runManifestBoundaryCheck(check);
      break;
    case "manifest-unsupported-fields":
      runManifestUnsupportedFieldsCheck(check);
      break;
    case "manifest-canonical-data-access":
      runManifestCanonicalDataAccessCheck(check);
      break;
    case "import-session-contract":
      runImportSessionContractCheck(check);
      break;
    case "build-provenance-boundary":
      runBuildProvenanceBoundaryCheck(check);
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
