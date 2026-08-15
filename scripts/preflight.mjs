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
import { analyzeAppDataContract } from "./app-data-contract.mjs";
import { analyzeCanonicalIntegrationContract } from "./canonical-integration-contract.mjs";
import { analyzeImportSessionContract, buildReviewSourceReachability } from "./import-session-contract.mjs";

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

const CANONICAL_DEMO_CATALOG_VERSION = "px_canonical_demo_v1";
const CANONICAL_DEMO_USES = new Set(["display", "calculation", "filter", "sort", "selection"]);
const CANONICAL_DEMO_OBJECT_CONTRACT = Object.fromEntries(
  Object.entries({
    household: ["households", "canonical.household.read", `id tenantId enterpriseId firmId name externalId taxFilingStatus taxState latestTaxYear latestTaxFilingId latestTaxDataSource latestTaxSyncedAt taxDataStatus notes assignedAdvisorUserIds status dedupeKey importJobId isDeleted deletedAt createdAt updatedAt createdBy updatedBy`],
    client_summary: ["clients", "canonical.client.summary.read", `id firmId householdId householdRole displayName firstName lastName status externalId dedupeKey summaryFlags.hasRestrictedPii summaryFlags.hasLinkedAccounts createdAt updatedAt`],
    client_detail: ["clients", "canonical.client.sensitive.read", `id tenantId enterpriseId firmId householdId householdRole clientUserId firstName lastName dateOfBirth emailPrimary emailSecondary phonePrimary phoneSecondary addressLine1 addressLine2 city state zip externalId status dedupeKey importJobId isDeleted deletedAt createdAt updatedAt createdBy updatedBy`],
    account: ["accounts", "canonical.account.read", `id tenantId enterpriseId firmId householdId accountNumber accountName custodianName accountType taxType taxTreatment accountStatus openingDate closedDate repCode accountBalance balanceAsOfDate totalCash securityBalance accountCategory accountSource groupName ownerClientIds properties properties.equityDividendReinvestment properties.closedEndMfDividendReinvestment properties.capitalGainsDividendReinvestment properties.dividendReinvestmentAddedDate properties.institutionName properties.docDeliveryConfirms properties.docDeliveryStatements properties.docDeliveryProspectus properties.docDeliveryProxy properties.docDeliveryTaxForms externalId dedupeKey importJobId isDeleted deletedAt createdAt updatedAt createdBy updatedBy`],
    position: ["positions", "canonical.position.read", `id tenantId firmId accountId asOfDate securityId cusip symbol securityName securityType currencyCode quantity price marketValue securityFactor repCode dedupeKey createdAt updatedAt sourceSystem importJobId importedAt isDeleted deletedAt`],
    transaction: ["transactions", "canonical.transaction.read", `id tenantId firmId accountId date asOfDate tradeDate settleDate displayTransactionType detailedTransactionType symbol cusip description status quantity price amount currencyCode netAmount fees commission accountGroup accountType repOnRecord householdName dedupeKey createdAt updatedAt sourceSystem importJobId importedAt isDeleted deletedAt`],
    cost_basis: ["cost_basis", "canonical.cost_basis.read", `id tenantId firmId accountId symbol cusip description acquisitionDate quantity marketValue costBasisUnadjusted costBasisAdjusted costBasisAmount currentValue gainLoss unrealizedGainLoss holdingPeriod asOfDate dedupeKey createdAt updatedAt sourceSystem importJobId importedAt isDeleted deletedAt`],
    security: ["securities", "canonical.security.read", `id ticker symbol cusip sedol isin securityName securityType status fees maturityDate yield taxStatus source dedupeKey createdAt updatedAt isDeleted deletedAt`],
    merged_security: ["securities", "canonical.security.read", `id ticker symbol cusip sedol isin securityName securityType status fees maturityDate yield taxStatus source dedupeKey createdAt updatedAt isDeleted deletedAt tickerId firmOverride firmOverride.id firmOverride.firmId firmOverride.securityId firmOverride.tickerId firmOverride.displayName firmOverride.returnExpectation firmOverride.assetClassId firmOverride.benchmark firmOverride.taxLossHarvestReplacement firmOverride.notes firmOverride.createdAt firmOverride.updatedAt firmOverride.createdBy firmOverride.updatedBy pxClassification pxClassification.label pxClassification.isMixed pxClassification.source pxClassification.allocations pxClassification.allocations.assetClassId pxClassification.allocations.assetClassName pxClassification.allocations.percent pxClassification.allocations.path pxClassification.allocations.source firmClassification firmClassification.label firmClassification.isMixed firmClassification.source firmClassification.allocations firmClassification.allocations.assetClassId firmClassification.allocations.assetClassName firmClassification.allocations.percent firmClassification.allocations.path firmClassification.allocations.source resolvedReturnExpectation resolvedReturnExpectation.value resolvedReturnExpectation.source resolvedReturnExpectation.sourceLabel`],
    model: ["models", "canonical.model.read", `id tenantId firmId name description assetManager status visibility dedupeKey createdAt updatedAt importJobId isDeleted deletedAt`],
    model_holding: ["models", "canonical.model.read", `id firmId modelId securityId tickerId weight taxSetting createdAt updatedAt`],
    sleeve: ["sleeves", "canonical.sleeve.read", `id tenantId firmId name description status dedupeKey createdAt updatedAt isDeleted deletedAt`],
    sleeve_allocation: ["sleeves", "canonical.sleeve.read", `id firmId sleeveId modelId weight taxSetting createdAt updatedAt`],
    crm_note: ["crm_notes", "canonical.crm_note.read", `id tenantId enterpriseId firmId sourceSystem sourceRecordId householdId clientId title content summaryFlags.hasRestrictedPii summaryFlags.redactedFields creatorExternalId creatorName visibleTo tagLabels sourceCreatedAt sourceUpdatedAt sourceLastSyncedAt status isDeleted deletedAt createdAt updatedAt createdBy updatedBy`],
    crm_task: ["crm_tasks", "canonical.crm_task.read", `id tenantId enterpriseId firmId sourceSystem sourceRecordId householdId clientId name description summaryFlags.hasRestrictedPii summaryFlags.redactedFields dueDate completed assigneeExternalId assigneeName categoryLabel tagLabels sourceCreatedAt sourceUpdatedAt sourceLastSyncedAt status isDeleted deletedAt createdAt updatedAt createdBy updatedBy`]
  }).map(([object, [category, permission, fields]]) => [
    object,
    { category, permission, fields: new Set(fields.trim().split(/\s+/)) }
  ])
);

function runManifestCanonicalDemoUsageCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  const manifest = readManifest() ?? {};
  if (manifest.canonicalDataUsageDeclarations === undefined) {
    report(check, true);
    return;
  }
  if (!Array.isArray(manifest.canonicalDataUsageDeclarations)) {
    report(check, false, "canonicalDataUsageDeclarations must be an array");
    return;
  }

  const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
  const ids = new Set();
  const issues = [];
  for (const declaration of manifest.canonicalDataUsageDeclarations) {
    const id = typeof declaration?.id === "string" ? declaration.id.trim() : "";
    const contract = CANONICAL_DEMO_OBJECT_CONTRACT[declaration?.object];
    if (!id || !contract || !Array.isArray(declaration?.fields) || declaration.fields.length === 0) {
      issues.push("canonicalDataUsageDeclarations contains an incomplete item");
      continue;
    }
    if (ids.has(id)) issues.push(`duplicate canonical Demo declaration id '${id}'`);
    ids.add(id);
    if (declaration.catalogVersion !== CANONICAL_DEMO_CATALOG_VERSION) {
      issues.push(`${id} must use ${CANONICAL_DEMO_CATALOG_VERSION}`);
    }
    if (declaration.category !== contract.category) {
      issues.push(`${id} object ${declaration.object} belongs to ${contract.category}`);
    }
    if (!permissions.has(contract.permission)) {
      issues.push(`${id} requires ${contract.permission}`);
    }
    const paths = new Set();
    for (const field of declaration.fields) {
      const path = typeof field?.path === "string" ? field.path.trim() : "";
      if (!path || paths.has(path) || path === "customFields" || path.startsWith("customFields.") || !contract.fields.has(path)) {
        issues.push(`${id} has unsupported or duplicate field '${path || "(empty)"}'`);
      }
      paths.add(path);
      if (!Array.isArray(field?.uses) || field.uses.length === 0 || field.uses.some((usage) => !CANONICAL_DEMO_USES.has(usage))) {
        issues.push(`${id}.${path || "(empty)"} has unsupported uses`);
      }
    }
  }

  if (manifest.canonicalDataUsageDeclarations.length > 0) {
    const boundary = getAppBoundary();
    const sourcePrefix = boundary.appRoot === "." ? "src/" : `${boundary.appRoot}/src/`;
    const distPrefix = `${boundary.distRoot}/`;
    const files = walkDir(ROOT, { includeDist: true })
      .map((filePath) => ({ path: toRelativePath(filePath), content: readFileSync(filePath, "utf-8") }));
    const source = files.filter((file) => file.path.startsWith(sourcePrefix));
    const dist = files.filter((file) => file.path.startsWith(distPrefix));
    const hasApi = (file) => /createPlannerXchangeDemoDataClient\s*\(|["'`]\/canonical-demo(?:\/|["'`])/.test(file.content);
    const sourceApi = source.find(hasApi);
    const distApi = dist.find(hasApi);
    if (!sourceApi) {
      issues.push("canonical Demo declarations require createPlannerXchangeDemoDataClient or the PX public /canonical-demo API in source");
    } else {
      if (!/scenario\s*:\s*["'`](?:smoke|standard|edge)["'`]/.test(sourceApi.content)) {
        issues.push("canonical Demo source must use a literal smoke, standard, or edge scenario");
      }
      if (!/catalogVersion\s*:\s*["'`]px_canonical_demo_v1["'`]/.test(sourceApi.content)) {
        issues.push("canonical Demo source must pin px_canonical_demo_v1");
      }
      if (!distApi) {
        issues.push("committed dist must retain createPlannerXchangeDemoDataClient or /canonical-demo");
      }
    }
  }

  report(check, issues.length === 0, issues.length > 0 ? issues.slice(0, 8).join("; ") : undefined);
}

function runImportSessionContractCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }

  const boundary = getAppBoundary();
  const sourcePrefix = boundary.appRoot === "." ? "src/" : `${boundary.appRoot}/src/`;
  const distPrefix = `${boundary.distRoot}/`;
  const configPrefix = boundary.appRoot === "." ? "" : `${boundary.appRoot}/`;
  const isResolverConfig = (path) =>
    path.startsWith(configPrefix) && /(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i.test(path);
  const reviewedFiles = walkDir(ROOT, { includeDist: true })
    .map((filePath) => ({ filePath, path: toRelativePath(filePath) }))
    .filter(
      (file) =>
        (file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)) ||
        (file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path)) ||
        isResolverConfig(file.path)
    )
    .map((file) => ({
      path: file.path,
      content: readFileSync(file.filePath, "utf-8")
    }));
  const sourceFiles = reviewedFiles.filter(
    (file) =>
      (file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)) ||
      isResolverConfig(file.path)
  );
  const distFiles = reviewedFiles.filter(
    (file) => file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path)
  );
  const issues = analyzeImportSessionContract({
    manifest: readManifest() ?? {},
    publishManifest: existsSync(resolve(ROOT, boundary.distRoot, "plannerxchange.publish.json"))
      ? JSON.parse(readFileSync(resolve(ROOT, boundary.distRoot, "plannerxchange.publish.json"), "utf-8"))
      : undefined,
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

function runAppDataContractCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }
  const boundary = getAppBoundary();
  const sourcePrefix = boundary.appRoot === "." ? "src/" : `${boundary.appRoot}/src/`;
  const distPrefix = `${boundary.distRoot}/`;
  const configPrefix = boundary.appRoot === "." ? "" : `${boundary.appRoot}/`;
  const files = walkDir(ROOT, { includeDist: true })
    .map((filePath) => ({ filePath, path: toRelativePath(filePath) }))
    .filter((file) =>
      (file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)) ||
      (file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path)) ||
      (file.path.startsWith(configPrefix) && /(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i.test(file.path))
    )
    .map((file) => ({ path: file.path, content: readFileSync(file.filePath, "utf-8") }));
  const sourceFiles = files.filter((file) => !file.path.startsWith(distPrefix));
  const distFiles = files.filter((file) => file.path.startsWith(distPrefix));
  const entrypointFile = boundary.appRoot === "."
    ? boundary.entryPoint
    : `${boundary.appRoot}/${boundary.entryPoint}`;
  const reachability = buildReviewSourceReachability({ sourceFiles, entrypointFiles: [entrypointFile] });
  const issues = analyzeAppDataContract({
    manifest: readManifest() ?? {},
    sourceFiles,
    distFiles,
    reachableSourceFiles: reachability.files,
    relevantResolverDiagnostics: reachability.relevantDiagnostics,
    traversalBounded: reachability.bounded,
  });
  report(
    check,
    issues.length === 0,
    issues.length > 0 ? issues.slice(0, 8).map((entry) => `${entry.code}: ${entry.message}`).join("; ") : undefined
  );
}

function runCanonicalIntegrationContractCheck(check) {
  if (!existsSync(MANIFEST_PATH)) {
    report(check, false, "plannerxchange.app.json not found");
    return;
  }
  const boundary = getAppBoundary();
  const sourcePrefix = boundary.appRoot === "." ? "src/" : `${boundary.appRoot}/src/`;
  const distPrefix = `${boundary.distRoot}/`;
  const files = walkDir(ROOT, { includeDist: true })
    .map((filePath) => ({ filePath, path: toRelativePath(filePath) }))
    .filter((file) =>
      (file.path.startsWith(sourcePrefix) && /\.(?:[cm]?[jt]sx?|html)$/.test(file.path)) ||
      (file.path.startsWith(distPrefix) && /\.(?:js|mjs|cjs|html)$/.test(file.path))
    )
    .map((file) => ({ path: file.path, content: readFileSync(file.filePath, "utf-8") }));
  const publishManifestPath = resolve(ROOT, boundary.distRoot, "plannerxchange.publish.json");
  const sourceFiles = files.filter((file) => file.path.startsWith(sourcePrefix));
  const entrypointFile = boundary.appRoot === "."
    ? boundary.entryPoint
    : `${boundary.appRoot}/${boundary.entryPoint}`;
  const reachability = buildReviewSourceReachability({ sourceFiles, entrypointFiles: [entrypointFile] });
  const issues = analyzeCanonicalIntegrationContract({
    manifest: readManifest() ?? {},
    publishManifest: existsSync(publishManifestPath)
      ? JSON.parse(readFileSync(publishManifestPath, "utf-8"))
      : undefined,
    sourceFiles,
    distFiles: files.filter((file) => file.path.startsWith(distPrefix)),
    reachableSourceFiles: reachability.files
  });
  report(
    check,
    issues.length === 0,
    issues.length > 0 ? issues.slice(0, 8).map((entry) => `${entry.code}: ${entry.message}`).join("; ") : undefined
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
    case "manifest-canonical-demo-usage":
      runManifestCanonicalDemoUsageCheck(check);
      break;
    case "import-session-contract":
      runImportSessionContractCheck(check);
      break;
    case "app-data-contract":
      runAppDataContractCheck(check);
      break;
    case "canonical-integration-contract":
      runCanonicalIntegrationContractCheck(check);
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
