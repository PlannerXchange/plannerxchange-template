import { CANONICAL_IMPORT_ENTITY_CATALOG } from "./import-session-contract.mjs";

const CATEGORY_SPECS = [
  ["households", "canonical.household.read", "household", ["household", "households"], ["listHouseholds", "getHouseholds", "getHousehold"], ["/households"]],
  ["clients", "canonical.client.summary.read", "client", ["client", "clients"], ["listClients", "getClients", "listClientUsers", "getClientUser"], ["/clients", "/client-users"]],
  ["accounts", "canonical.account.read", "account", ["account", "accounts"], ["listAccounts", "getAccounts", "getAccount"], ["/accounts"]],
  ["positions", "canonical.position.read", "account", ["position", "positions", "holding", "holdings"], ["listPositions", "listAccountPositions", "getPositions"], ["/positions"]],
  ["transactions", "canonical.transaction.read", "account", ["transaction", "transactions"], ["listTransactions", "listAccountTransactions", "getTransactions"], ["/transactions"]],
  ["cost_basis", "canonical.cost_basis.read", "account", ["cost basis", "tax lot", "tax lots"], ["listCostBasis", "listAccountCostBasis", "getCostBasis"], ["/cost-basis"]],
  ["securities", "canonical.security.read", "firm", ["security", "securities"], ["listSecurities", "getSecurity"], ["/securities"]],
  ["models", "canonical.model.read", "model", ["model", "models", "model holding", "model holdings"], ["listModels", "getModel", "listModelHoldings"], ["/models"]],
  ["sleeves", "canonical.sleeve.read", "sleeve", ["sleeve", "sleeves", "sleeve allocation", "sleeve allocations"], ["listSleeves", "getSleeve", "listSleeveAllocations"], ["/sleeves"]]
].map(([category, permission, selectionEntity, labels, methods, routes]) => ({ category, permission, selectionEntity, labels, methods, routes }));

const ENTITY_CATEGORY = new Map([
  ["household", "households"], ["client", "clients"], ["account", "accounts"],
  ["position", "positions"], ["transaction", "transactions"], ["cost_basis", "cost_basis"],
  ["security", "securities"], ["model", "models"], ["model_holding", "models"],
  ["sleeve", "sleeves"], ["sleeve_allocation", "sleeves"]
]);
const APP_LOCAL_LABEL = /\b(?:scenario|hypothetical|sample|demo)\s+(?:participant|person|household|client|account)\b/i;
const LOCAL_ID = /\b(?:crypto\s*\.\s*randomUUID|randomUUID|nanoid|uuidv4|Math\s*\.\s*random|Date\s*\.\s*now|function\s+uid\b|const\s+uid\s*=)\b/;
const APP_DATA_IDENTITY = /\b(?:setClientLabel|client[_-]?labels?|household[_-]?labels?|account[_-]?labels?|(?:list|create|update|get|delete)AppData(?:Record)?s?)\b|\/app-data\b/i;
const OVERLAY_RECORD = /\b(?:overlays?|overrides?|annotations?|preferences?|settings?|category[_-]?memor(?:y|ies)|confirmations?|contexts?|notes?|budgets?)\b/i;

function issue(code, message, file, line) {
  return { code, message, file, line };
}

function isCodeFile(path) {
  return /\.(?:[cm]?[jt]sx?|html)$/i.test(path) &&
    !/(?:^|\/)(?:test|tests|mock|mocks|fixture|fixtures|example|examples|sample|samples|preview|sandbox)(?:\/|[-_.]|$)/i.test(path);
}

function lineNumber(content, offset) {
  return content.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderedClaims(files) {
  const claims = new Map();
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*(?:\/\/|\/\*|\*|import\b|export\b)/.test(line) || /\b(?:import|upload)\s+(?:data|csv|file|records?|households?|clients?|accounts?|positions?|holdings?|transactions?|tax\s+lots?|cost\s+basis|securities|models?|sleeves?)\b/i.test(line) || /openDataImportSession/.test(line)) return;
      for (const spec of CATEGORY_SPECS) {
        if (claims.has(spec.category)) continue;
        const labels = spec.labels.map(escapeRegex).join("|");
        const quote = `["'\\x60]`;
        const label = new RegExp(`(?:<h[1-6][^>]*>|<a[^>]*>|<button[^>]*>|\\b(?:label|title|name|path|route|to|href)\\s*[:=]\\s*${quote})[^\\n]{0,160}\\b(?:${labels})\\b`, "i");
        const route = new RegExp(`${quote}(?:${spec.routes.map(escapeRegex).join("|")})(?:[/?"'\\x60])`, "i");
        if (label.test(line) || route.test(line)) claims.set(spec.category, { file: file.path, line: index + 1 });
      }
    });
  }
  return claims;
}

function canonicalUsages(files) {
  const usages = [];
  const seen = new Set();
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;
    for (const spec of CATEGORY_SPECS) {
      const methodPattern = new RegExp(`\\.\\s*(${spec.methods.map(escapeRegex).join("|")})\\s*\\(`, "g");
      for (const match of file.content.matchAll(methodPattern)) {
        const symbol = match[1];
        const key = `${file.path}|${spec.category}|${symbol}`;
        if (!seen.has(key)) {
          seen.add(key);
          usages.push({ ...spec, file: file.path, line: lineNumber(file.content, match.index), symbol });
        }
      }
      for (const route of spec.routes) {
        const routePattern = new RegExp(`(?:authenticatedFetch|requestJson|fetch)\\s*\\(\\s*["'\\x60]([^"'\\x60]*${escapeRegex(route)}(?:[/?][^"'\\x60]*)?)["'\\x60]`, "g");
        for (const match of file.content.matchAll(routePattern)) {
          const key = `${file.path}|${spec.category}|${match[1]}`;
          if (!seen.has(key)) {
            seen.add(key);
            usages.push({ ...spec, file: file.path, line: lineNumber(file.content, match.index), symbol: match[1] });
          }
        }
      }
    }
  }
  return usages;
}

function canonicalControlCandidates(files) {
  const candidates = [];
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;
    file.content.split(/\r?\n/).forEach((line, index) => {
      if (APP_LOCAL_LABEL.test(line) || /^\s*(?:\/\/|\/\*|\*)/.test(line)) return;
      const entity = /\bclient(?:\s+(?:name|email|id))?\b/i.test(line) ? "client"
        : /\bhousehold(?:\s+(?:name|id))?\b/i.test(line) ? "household"
          : /\baccount(?:\s+(?:name|id|number))?\b/i.test(line) ? "account" : undefined;
      if (!entity) return;
      if (/<label\b|\b(?:placeholder|aria-label|label|name|field|fieldName|id)\s*[:=]/i.test(line)) {
        candidates.push({ file: file.path, line: index + 1, entity });
      }
    });
  }
  return candidates;
}

function importedCategories(manifest) {
  const result = new Set();
  for (const declaration of manifest?.dataIngressDeclarations ?? []) {
    if (declaration?.target !== "px_import_session") continue;
    for (const entity of declaration.canonicalEntityHints ?? []) {
      const category = ENTITY_CATEGORY.get(entity);
      if (category) result.add(category);
    }
  }
  return result;
}

function mappedArtifacts(distFiles, publishManifest) {
  const entries = Object.values(publishManifest?.entryPoints ?? {}).map((entry) => entry?.file).filter(Boolean);
  if (entries.length === 0) return distFiles;
  const byPath = new Map(distFiles.map((file) => [file.path.replace(/\\/g, "/"), file]));
  const selected = new Map();
  const pending = entries.flatMap((entry) => {
    const normalized = String(entry).replace(/^\.\//, "");
    return [normalized, `dist/${normalized}`];
  });
  while (pending.length) {
    const path = pending.shift();
    const file = byPath.get(path);
    if (!file || selected.has(path)) continue;
    selected.set(path, file);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    for (const match of file.content.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const parts = `${parent}${match[1]}`.split("/");
      const normalized = [];
      for (const part of parts) part === ".." ? normalized.pop() : part !== "." && normalized.push(part);
      pending.push(normalized.join("/"));
    }
  }
  return [...selected.values()];
}

function artifactHasUsage(usage, distFiles, publishManifest) {
  return mappedArtifacts(distFiles, publishManifest).some((file) =>
    [usage.symbol, ...usage.routes].some((marker) => marker.length >= 4 && file.content.includes(marker))
  );
}

function shadowStorage(files, spec) {
  const category = new RegExp(`\\b(?:${spec.labels.map(escapeRegex).join("|")})\\b`, "i");
  for (const file of files) {
    if (!isCodeFile(file.path) || !/\/app-data\b|\b(?:list|create|update|get|delete)AppData(?:Record)?s?\b/i.test(file.content)) continue;
    for (const match of file.content.matchAll(/(?:\brecordType\s*[:=]\s*|\b(?:list|get|create|update|delete)AppData(?:Record)?s?\s*\(\s*)["'`]([A-Za-z0-9_.:-]{3,120})["'`]/g)) {
      const value = match[1].replace(/[_:.-]+/g, " ");
      if (category.test(value) && !OVERLAY_RECORD.test(value)) return { file: file.path, line: lineNumber(file.content, match.index), recordType: match[1] };
    }
  }
  return undefined;
}

export function analyzeCanonicalIntegrationContract({ manifest = {}, publishManifest, sourceFiles = [], distFiles = [], reachableSourceFiles }) {
  const issues = [];
  const reachable = reachableSourceFiles?.length ? new Set(reachableSourceFiles.map((path) => path.replace(/\\/g, "/"))) : undefined;
  const relevantSourceFiles = reachable ? sourceFiles.filter((file) => reachable.has(file.path.replace(/\\/g, "/"))) : sourceFiles;
  const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
  const declarations = Array.isArray(manifest.canonicalDataAccessDeclarations) ? manifest.canonicalDataAccessDeclarations : [];
  const claims = renderedClaims(relevantSourceFiles);
  const imports = importedCategories(manifest);
  const usages = canonicalUsages(relevantSourceFiles);
  const claimedCategories = new Set(usages.map((usage) => usage.category));
  for (const category of imports) if (claims.has(category)) claimedCategories.add(category);
  if (manifest.dataPortabilityMode === "plannerxchange_portable") for (const category of claims.keys()) claimedCategories.add(category);

  for (const candidate of canonicalControlCandidates(relevantSourceFiles)) {
    const spec = CATEGORY_SPECS.find((entry) => entry.selectionEntity === candidate.entity && ["households", "clients", "accounts"].includes(entry.category));
    const file = relevantSourceFiles.find((entry) => entry.path === candidate.file);
    if (!spec || !file || usages.some((usage) => usage.category === spec.category)) continue;
    const lines = file.content.split(/\r?\n/);
    const window = lines.slice(Math.max(0, candidate.line - 7), candidate.line + 7).join("\n");
    const freeText = /<input\b|\btype\s*=\s*["'`]text["'`]|\bTextInput\b/.test(window) && !/<select\b|\bcombobox\b|\bautocomplete\b/i.test(window);
    if (freeText && LOCAL_ID.test(file.content) && relevantSourceFiles.some((entry) => APP_DATA_IDENTITY.test(entry.content))) {
      claimedCategories.add(spec.category);
      issues.push(issue("canonical-entity-control-not-integrated", `The rendered ${candidate.entity} control is free text and uses an app-local identity. Replace it with a searchable PX selector, request ${spec.permission}, add a matching ${spec.category} read declaration, retain the canonical ID, and rebuild committed output.`, candidate.file, candidate.line));
    }
  }

  for (const category of claimedCategories) {
    const spec = CATEGORY_SPECS.find((entry) => entry.category === category);
    const usage = usages.find((entry) => entry.category === category);
    const claim = claims.get(category) ?? usage;
    if (!spec || !claim) continue;
    const missing = [];
    if (!permissions.has(spec.permission)) missing.push(`permission ${spec.permission}`);
    if (!declarations.some((entry) => entry?.category === category && entry.scopes?.includes("read"))) missing.push(`a canonicalDataAccessDeclarations read entry for ${category}`);
    if (!usage) missing.push(`a reachable canonical ${category} GET/SDK read`);
    if (missing.length) {
      issues.push(issue("canonical-data-integration-incomplete", `The app presents a ${category} working surface${imports.has(category) ? " and imports the same category" : ""}, but is missing ${missing.join(", ")}. Complete all three contract layers, retain canonical IDs, and rebuild committed dist plus provenance.`, claim.file, claim.line));
    } else if (!artifactHasUsage(usage, distFiles, publishManifest)) {
      issues.push(issue("canonical-data-build-artifact-missing", `The canonical ${category} source read '${usage.symbol}' is absent from the mapped committed build. Rebuild dist and plannerxchange.build-provenance.json from the reviewed source.`, usage.file, usage.line));
    }
    const shadow = shadowStorage(relevantSourceFiles, spec);
    if (shadow) issues.push(issue("canonical-data-shadow-storage", `App-data record type '${shadow.recordType}' shadows canonical ${category}. Read PX canonical records and persist only app-owned overlays linked to canonical IDs, then rebuild.`, shadow.file, shadow.line));
  }
  return issues;
}

export const CANONICAL_INTEGRATION_CATEGORIES = CATEGORY_SPECS.map(({ category, permission, selectionEntity }) => ({ category, permission, selectionEntity }));
