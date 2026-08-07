const ALLOWED_INGRESS_SOURCES = new Set([
  "csv_upload",
  "file_upload",
  "third_party_api",
  "manual_paste",
  "browser_file_parse",
  "other"
]);

const ALLOWED_INGRESS_TARGETS = new Set([
  "px_import_session",
  "px_app_data_upload",
  "browser_ephemeral_app_data",
  "enterprise_external_exception"
]);

const ALLOWED_DATA_CLASSES = new Set([
  "public",
  "internal",
  "confidential",
  "restricted_pii",
  "firm_data",
  "client_summary",
  "client_sensitive",
  "crm_activity",
  "account_data",
  "portfolio_positions",
  "transactions",
  "cost_basis",
  "security_reference",
  "model_portfolios",
  "app_work_product"
]);

export const CANONICAL_IMPORT_ENTITY_CATALOG = [
  ["household", "client_summary", ["household", "households"], { parentEntityTypes: [], resolvesSecurities: false, csvColumns: ["name", "external_id", "tax_filing_status", "tax_state", "notes"] }],
  ["client", "client_sensitive", ["client", "clients"], { parentEntityTypes: ["household"], resolvesSecurities: false, csvColumns: ["first_name", "last_name", "household_name", "household_id", "date_of_birth", "ssn_tin", "email_primary", "email_secondary", "phone_primary", "phone_secondary", "address_line_1", "address_line_2", "city", "state", "zip", "external_id"] }],
  ["account", "account_data", ["account", "accounts"], { parentEntityTypes: ["household", "client"], resolvesSecurities: false, csvColumns: ["account_number", "account_name", "custodian_name", "household_name", "household_id", "owner_name", "account_type", "tax_type", "account_status", "opening_date", "closed_date", "rep_code", "account_balance", "balance_as_of_date", "total_cash", "security_balance", "external_id"] }],
  ["position", "portfolio_positions", ["position", "positions", "holdings", "portfolio holdings"], { parentEntityTypes: ["account", "security"], resolvesSecurities: true, csvColumns: ["account_number", "account_name", "as_of_date", "symbol", "cusip", "security_name", "security_type", "quantity", "price", "market_value", "currency_code"] }],
  ["transaction", "transactions", ["transaction", "transactions"], { parentEntityTypes: ["account", "security"], resolvesSecurities: true, csvColumns: ["account_number", "date", "symbol", "cusip", "display_transaction_type", "description", "quantity", "price", "amount", "currency_code", "net_amount", "fees", "commission"] }],
  ["cost_basis", "cost_basis", ["cost basis", "cost-basis", "tax lot", "tax lots"], { parentEntityTypes: ["account", "security"], resolvesSecurities: true, csvColumns: ["account_number", "account_name", "as_of_date", "symbol", "cusip", "security_name", "security_type", "acquisition_date", "quantity", "price", "market_value", "cost_basis_amount", "cost_basis_unadjusted", "cost_basis_adjusted", "unrealized_gain_loss", "gain_loss", "holding_period", "lot_id"] }],
  ["security", "security_reference", ["security", "securities", "security reference"], { parentEntityTypes: [], resolvesSecurities: false, csvColumns: ["symbol", "cusip", "sedol", "isin", "security_name", "security_type", "fees", "maturity_date", "yield", "tax_status"] }],
  ["model", "model_portfolios", ["model", "models", "model portfolio", "model portfolios"], { parentEntityTypes: [], resolvesSecurities: false, csvColumns: ["name", "description", "asset_manager", "status", "visibility"] }],
  ["model_holding", "model_portfolios", ["model holding", "model holdings", "model composition"], { parentEntityTypes: ["model", "security"], resolvesSecurities: true, csvColumns: ["model_id", "model_name", "security_id", "symbol", "cusip", "weight", "tax_setting"] }],
  ["sleeve", "model_portfolios", ["sleeve", "sleeves"], { parentEntityTypes: [], resolvesSecurities: false, csvColumns: ["name", "description", "status"] }],
  ["sleeve_allocation", "model_portfolios", ["sleeve allocation", "sleeve allocations", "sleeve composition"], { parentEntityTypes: ["sleeve", "model"], resolvesSecurities: false, csvColumns: ["sleeve_id", "sleeve_name", "model_id", "model_name", "weight", "tax_setting"] }]
];
const CANONICAL_IMPORT_BY_ENTITY = new Map(
  CANONICAL_IMPORT_ENTITY_CATALOG.map(([entityType, requiredDataClass]) => [entityType, requiredDataClass])
);

const IMPORT_ENTRYPOINT_PATTERN = new RegExp(
  `(?:\\bimport\\s+data\\b|\\bdata\\s+import\\b|\\b(?:import|upload)\\s+(?:${CANONICAL_IMPORT_ENTITY_CATALOG.flatMap(([, , aliases]) => aliases).sort((a, b) => b.length - a.length).map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b)`,
  "i"
);
const TERMINAL_IMPORT_COPY_PATTERN =
  /(?:import(?:s|ing)?\s+(?:is|are)\s+managed\s+by\s+PlannerXchange|once\s+PlannerXchange\s+imports?|will\s+appear\s+automatically)/i;
const IMPORT_CALL_PATTERN = /\b([A-Za-z_$][\w$]*)\s*!?\s*(?:\?\.)?\s*\(\s*\{([\s\S]{0,1800}?)\}\s*\)/g;
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|html)$/i;
const ACTUAL_FILE_INGRESS_PATTERN =
  /(?:<input\b[^>]*\btype\s*=\s*["']file["']|\bFileReader\b|\bXLSX\s*\.\s*read\s*\(|\breadFile\s*\(|\bsheet_to_json\s*\(|\bPapa\s*\.\s*parse\s*\(|\b(?:onDrop|dropzone|DataTransfer\.files)\b)/i;

function normalizePath(value) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function maskCodeComments(content) {
  const mask = (value) => value.replace(/[^\r\n]/g, " ");
  return content
    .replace(/\/\*[\s\S]*?\*\//g, mask)
    .replace(/(^|\s)\/\/[^\r\n]*/gm, (value) => mask(value));
}

function isOffsetInsideCodeStringOrComment(content, targetOffset) {
  let state = "code";
  for (let index = 0; index < targetOffset; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (state === "line_comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block_comment") {
      if (character === "*" && next === "/") { state = "code"; index += 1; }
      continue;
    }
    if (state !== "code") {
      if (character === "\\") { index += 1; continue; }
      if ((state === "single" && character === "'") ||
          (state === "double" && character === "\"") ||
          (state === "template" && character === "`")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") { state = "line_comment"; index += 1; }
    else if (character === "/" && next === "*") { state = "block_comment"; index += 1; }
    else if (character === "'") state = "single";
    else if (character === "\"") state = "double";
    else if (character === "`") state = "template";
  }
  return state !== "code";
}

function extractRenderedElements(content) {
  const elements = [];
  for (const match of content.matchAll(/<([A-Za-z][\w.]*)\b/g)) {
    const start = match.index ?? 0;
    if (isOffsetInsideCodeStringOrComment(content, start)) continue;
    let quote;
    let braceDepth = 0;
    let openingEnd = -1;
    for (let index = start + match[0].length; index < content.length; index += 1) {
      const character = content[index];
      if (quote) {
        if (character === "\\") index += 1;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === "\"" || character === "'" || character === "`") { quote = character; continue; }
      if (character === "{") braceDepth += 1;
      else if (character === "}" && braceDepth > 0) braceDepth -= 1;
      else if (character === ">" && braceDepth === 0) { openingEnd = index + 1; break; }
    }
    if (openingEnd < 0) continue;
    const closing = new RegExp(`</${match[1].replace(/[.]/g, "\\.")}\\s*>`, "g");
    closing.lastIndex = openingEnd;
    const closingMatch = closing.exec(content);
    if (!closingMatch) continue;
    elements.push({
      tag: match[1],
      attributes: content.slice(start + match[0].length, openingEnd - 1),
      inner: content.slice(openingEnd, closingMatch.index),
      start,
      end: closingMatch.index + closingMatch[0].length
    });
  }
  return elements;
}

function isFixturePath(path) {
  return /(?:^|\/)(?:__tests__|test|tests|fixtures?|mocks?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(normalizePath(path));
}

function stableEntrypointId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `import-entry-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function lineNumber(content, offset) {
  return content.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

function resolveStaticStrings(content) {
  const values = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`\r\n]+)\2/g;
  for (const match of content.matchAll(pattern)) {
    values.set(match[1], match[3]);
  }
  return values;
}

function resolveImportHelperSymbols(content) {
  const symbols = new Set(["openDataImportSession"]);
  const parameterListPatterns = [
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\(([^)]{0,600})\)/g,
    /\(([^)]{0,600})\)\s*(?::[^=]{0,200})?=>/g
  ];
  for (const parameterListPattern of parameterListPatterns) {
    for (const match of content.matchAll(parameterListPattern)) {
      for (const parameter of match[1].matchAll(
        /\b([a-z_$][\w$]*openDataImportSession[\w$]*)\b/g
      )) {
        symbols.add(parameter[1]);
      }
    }
  }
  for (const match of content.matchAll(
    /\b([a-z_$][\w$]*openDataImportSession[\w$]*)\s*(?::[^=]{0,200})?=>/g
  )) {
    symbols.add(match[1]);
  }

  for (const match of content.matchAll(
    /\b(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*[^;\n]{0,240}(?:\.|\?\.)\s*openDataImportSession\b/g
  )) {
    symbols.add(match[1]);
  }

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const match of content.matchAll(
      /\b(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\b/g
    )) {
      if (symbols.has(match[2]) && !symbols.has(match[1])) {
        symbols.add(match[1]);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return symbols;
}

function extractCalls(files, source) {
  const calls = [];
  for (const file of files) {
    if (!CODE_FILE_PATTERN.test(file.path) || isFixturePath(file.path)) continue;
    const content = maskCodeComments(file.content);
    const staticStrings = resolveStaticStrings(content);
    const helperSymbols = resolveImportHelperSymbols(content);
    for (const match of content.matchAll(IMPORT_CALL_PATTERN)) {
      if (!helperSymbols.has(match[1])) continue;
      const body = match[2];
      const literal = body.match(/\bdeclarationId\s*:\s*(["'`])([^"'`\r\n]+)\1/);
      const identifier = body.match(/\bdeclarationId\s*:\s*([A-Za-z_$][\w$]*)/);
      const declarationId = literal?.[2] ?? (identifier ? staticStrings.get(identifier[1]) : undefined);
      calls.push({
        source,
        file: file.path,
        declarationId,
        unresolved: !declarationId,
        invocationKind: match[1] === "openDataImportSession" ? "direct_call" : "alias_call",
        offset: match.index ?? 0,
        line: lineNumber(content, match.index ?? 0),
        usesRemovedProperties:
          new RegExp(`\\b(?:${"returnTo" + "App"}|${"meta" + "data"})\\s*:`).test(body)
      });
    }
  }
  return calls;
}

function resolveFileCandidate(base, availablePaths) {
  const normalizedBase = normalizePath(base);
  return [
    normalizedBase,
    `${normalizedBase}.ts`,
    `${normalizedBase}.tsx`,
    `${normalizedBase}.js`,
    `${normalizedBase}.jsx`,
    `${normalizedBase}.mjs`,
    `${normalizedBase}.cjs`,
    `${normalizedBase}/index.ts`,
    `${normalizedBase}/index.tsx`,
    `${normalizedBase}/index.js`,
    `${normalizedBase}/index.jsx`
  ].find((candidate) => availablePaths.has(candidate));
}

function resolveRelativeImport(importerPath, specifier, availablePaths) {
  const importerParts = normalizePath(importerPath).split("/");
  importerParts.pop();
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") importerParts.pop();
    else importerParts.push(part);
  }
  return resolveFileCandidate(importerParts.join("/"), availablePaths);
}

function parseJsonConfig(content) {
  try {
    return JSON.parse(content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
      .replace(/,\s*([}\]])/g, "$1"));
  } catch {
    return undefined;
  }
}

function buildImportAliasRules(files) {
  const rules = [];
  const configFiles = new Map(files
    .filter((file) => /(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/i.test(normalizePath(file.path)))
    .map((file) => [normalizePath(file.path), file]));
  const visited = new Set();
  const visit = (file) => {
    const configPath = normalizePath(file.path);
    if (visited.has(configPath)) return;
    visited.add(configPath);
    const parsed = parseJsonConfig(file.content);
    const configDirectory = configPath.split("/").slice(0, -1).join("/");
    if (typeof parsed?.extends === "string" && parsed.extends.startsWith(".")) {
      const parentBase = normalizePath(`${configDirectory}/${parsed.extends}`);
      const parent = configFiles.get(parentBase) ?? configFiles.get(`${parentBase}.json`);
      if (parent) visit(parent);
    }
    const options = parsed?.compilerOptions;
    if (!options || typeof options !== "object") return;
    const baseUrl = typeof options.baseUrl === "string" ? options.baseUrl : ".";
    if (options.paths && typeof options.paths === "object") {
      for (const [pattern, targets] of Object.entries(options.paths)) {
        if (Array.isArray(targets) && targets.every((target) => typeof target === "string")) {
          rules.push({ pattern, targets, configDirectory, baseUrl, fallback: false });
        }
      }
    }
    rules.push({ pattern: "*", targets: ["*"], configDirectory, baseUrl, fallback: true });
  };
  for (const file of configFiles.values()) visit(file);
  return rules;
}

function resolveAliasImport(specifier, availablePaths, rules) {
  const matches = new Set();
  let matchedRule = false;
  let matchedExplicitRule = false;
  for (const rule of rules) {
    if (rule.fallback && matchedExplicitRule) continue;
    const wildcardIndex = rule.pattern.indexOf("*");
    const prefix = wildcardIndex >= 0 ? rule.pattern.slice(0, wildcardIndex) : rule.pattern;
    const suffix = wildcardIndex >= 0 ? rule.pattern.slice(wildcardIndex + 1) : "";
    const matchesPattern = wildcardIndex >= 0
      ? specifier.startsWith(prefix) && specifier.endsWith(suffix)
      : specifier === rule.pattern;
    if (!matchesPattern) continue;
    if (!rule.fallback) {
      matchedRule = true;
      matchedExplicitRule = true;
    }
    const wildcard = wildcardIndex >= 0
      ? specifier.slice(prefix.length, specifier.length - suffix.length)
      : "";
    for (const target of rule.targets) {
      const mapped = target.replace("*", wildcard);
      const resolved = resolveFileCandidate(
        [rule.configDirectory, rule.baseUrl, mapped].filter(Boolean).join("/"),
        availablePaths
      );
      if (resolved) {
        matches.add(resolved);
        matchedRule = true;
      }
    }
  }
  if (!matchedRule && /^(?:@|~)\//.test(specifier)) {
    const suffix = specifier.slice(2);
    const candidates = [
      `src/${suffix}.ts`, `src/${suffix}.tsx`, `src/${suffix}.js`, `src/${suffix}.jsx`,
      `src/${suffix}/index.ts`, `src/${suffix}/index.tsx`, `src/${suffix}/index.js`, `src/${suffix}/index.jsx`
    ];
    for (const path of availablePaths) {
      if (candidates.some((candidate) => path === candidate || path.endsWith(`/${candidate}`))) matches.add(path);
    }
    matchedRule = true;
  }
  if (matches.size === 1) return { resolved: [...matches][0], potentialLocal: true, kind: "path_alias" };
  if (matchedRule) {
    return {
      potentialLocal: true,
      diagnostic: matches.size > 1
        ? `Ambiguous local import alias: ${specifier}`
        : `Unresolved local import alias: ${specifier}`
    };
  }
  return { potentialLocal: false };
}

function normalizeImportDestination(value) {
  if (!value) return undefined;
  const normalized = value
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/g, "")
    .replace(/\/+/g, "/");
  return normalized || "/";
}

function importDestinationsCompatible(left, right) {
  if (!left || !right) return false;
  const leftParts = left.split("/").filter(Boolean);
  const rightParts = right.split("/").filter(Boolean);
  if (leftParts.length !== rightParts.length) {
    const shorter = leftParts.length < rightParts.length ? leftParts : rightParts;
    const longer = leftParts.length < rightParts.length ? rightParts : leftParts;
    return shorter.length > 0 && shorter.every((part, index) => {
      const candidate = longer[longer.length - shorter.length + index];
      return part === candidate || part.startsWith(":") || candidate?.startsWith(":");
    });
  }
  return leftParts.every((part, index) => {
    const candidate = rightParts[index];
    return part === candidate || part.startsWith(":") || candidate?.startsWith(":");
  });
}

function detectEntrypointEntities(text) {
  const matches = [];
  for (const [entityType, , aliases] of CANONICAL_IMPORT_ENTITY_CATALOG) {
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(`\\b(?:import|upload)\\s+${escaped}\\b`, "i").exec(text);
      if (match) matches.push({ entityType, index: match.index, length: match[0].length });
    }
  }
  return [...new Set(matches
    .filter((candidate) => !matches.some((other) => other.index === candidate.index && other.length > candidate.length))
    .map((candidate) => candidate.entityType))];
}

function findImportEntrypoints(files) {
  const entrypoints = [];
  const routePattern = /\b(path|route|to|href)\s*[:=]\s*(?:\{\s*)?["'`]([^"'`]*(?:\/import\b|import-data\b|data-import\b)[^"'`]*)["'`]/gi;
  const routerCallPattern = /\b(?:navigate|setLocation|router\.(?:push|replace)|history\.(?:push|replace))\s*\(\s*["'`]([^"'`]*(?:\/import\b|import-data\b|data-import\b)[^"'`]*)["'`]/gi;
  const accessibilityPattern = /\b(?:aria-label|title)\s*=\s*["'`]([^"'`]{1,240})["'`]/gi;
  const renderedText = (value) => value.replace(/<[^>]+>/g, " ").replace(/\{[^{}]*\}/g, " ").replace(/\s+/g, " ").trim();
  const isInteractive = (tag, attributes) => /^(?:button|a|Button|Link|NavLink|MenuItem|DropdownMenuItem)$/i.test(tag) ||
    /\b(?:onClick|onKeyDown|href|to|role\s*=\s*["'](?:button|link|menuitem)["'])\b/i.test(attributes);

  for (const file of files) {
    if (!CODE_FILE_PATTERN.test(file.path) || isFixturePath(file.path)) continue;
    const normalizedFile = normalizePath(file.path);
    const isRenderedFile = /\.(?:tsx|jsx|html)$/i.test(normalizedFile);
    const content = maskCodeComments(file.content);
    for (const routeMatch of content.matchAll(routePattern)) {
      const offset = routeMatch.index ?? 0;
      if (isOffsetInsideCodeStringOrComment(file.content, offset)) continue;
      const navigation = /^(?:to|href)$/i.test(routeMatch[1] ?? "");
      const destination = normalizeImportDestination(routeMatch[2]);
      const entityTypes = detectEntrypointEntities(routeMatch[0]);
      entrypoints.push({
        entrypointId: stableEntrypointId(`${normalizedFile}:${destination}:${entityTypes.join(",") || "generic"}`),
        file: normalizedFile, signal: navigation ? "navigation" : "route", text: routeMatch[0],
        line: lineNumber(content, offset), offset, entityTypes, destination
      });
    }
    for (const routerCallMatch of content.matchAll(routerCallPattern)) {
      const offset = routerCallMatch.index ?? 0;
      if (isOffsetInsideCodeStringOrComment(file.content, offset)) continue;
      const destination = normalizeImportDestination(routerCallMatch[1]);
      const entityTypes = detectEntrypointEntities(routerCallMatch[0]);
      entrypoints.push({
        entrypointId: stableEntrypointId(`${normalizedFile}:${destination}:${entityTypes.join(",") || "generic"}`),
        file: normalizedFile, signal: "navigation", text: routerCallMatch[0],
        line: lineNumber(content, offset), offset, entityTypes, destination
      });
    }
    if (isRenderedFile) {
      const elements = extractRenderedElements(file.content);
      for (const element of elements) {
        if (!isInteractive(element.tag, element.attributes)) continue;
        const text = renderedText(element.inner);
        const accessible = [...element.attributes.matchAll(accessibilityPattern)].map((match) => match[1]).join(" ");
        const copy = [text, accessible].filter(Boolean).join(" ");
        if (!IMPORT_ENTRYPOINT_PATTERN.test(copy)) continue;
        const entityTypes = detectEntrypointEntities(copy);
        entrypoints.push({
          entrypointId: stableEntrypointId(`${normalizedFile}:${copy.toLowerCase().replace(/\s+/g, " ").trim()}:${entityTypes.join(",") || "generic"}`),
          file: normalizedFile, signal: "user_copy", text: copy,
          line: lineNumber(content, element.start), offset: element.start, entityTypes
        });
      }
      if (/(?:^|\/)(?:import(?:[-_.][^/]*)?|importdata)\.[cm]?[jt]sx?$|(?:^|\/)(?:import|data-import)(?:\/|$)/i.test(normalizedFile)) {
        for (const element of elements) {
          if (!/^(?:h[1-6]|CardTitle|DialogTitle|SheetTitle)$/i.test(element.tag)) continue;
          const copy = renderedText(element.inner);
          if (!IMPORT_ENTRYPOINT_PATTERN.test(copy)) continue;
          const entityTypes = detectEntrypointEntities(copy);
          entrypoints.push({
            entrypointId: stableEntrypointId(`${normalizedFile}:${copy.toLowerCase().replace(/\s+/g, " ").trim()}:${entityTypes.join(",") || "generic"}`),
            file: normalizedFile, signal: "component", text: copy,
            line: lineNumber(content, element.start), offset: element.start, entityTypes
          });
        }
      }
    }
  }
  return entrypoints.filter((entrypoint, index) =>
    entrypoints.findIndex((candidate) => candidate.entrypointId === entrypoint.entrypointId) === index
  );
}

function findClosingBrace(content, opening) {
  let depth = 0;
  let state = "code";
  for (let index = opening; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (state === "line_comment") { if (character === "\n") state = "code"; continue; }
    if (state === "block_comment") { if (character === "*" && next === "/") { state = "code"; index += 1; } continue; }
    if (state !== "code") {
      if (character === "\\") { index += 1; continue; }
      if ((state === "single" && character === "'") || (state === "double" && character === "\"") || (state === "template" && character === "`")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") { state = "line_comment"; index += 1; continue; }
    if (character === "/" && next === "*") { state = "block_comment"; index += 1; continue; }
    if (character === "'") { state = "single"; continue; }
    if (character === "\"") { state = "double"; continue; }
    if (character === "`") { state = "template"; continue; }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return index + 1;
  }
  return content.length;
}

function extractSourceExecutionRanges(content) {
  const ranges = [];
  const blockPattern = /\b(export\s+default\s+)?(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)?\s*\([^)]{0,600}\)\s*(?::[^\{]{0,300})?\{|\b(export\s+default\s+)?(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]{0,200})?=>\s*\{/g;
  for (const match of content.matchAll(blockPattern)) {
    const opening = (match.index ?? 0) + match[0].lastIndexOf("{");
    ranges.push({ name: match[2] ?? match[4], isDefault: Boolean(match[1] ?? match[3]), start: match.index ?? 0, end: findClosingBrace(content, opening) });
  }
  const expressionPattern = /\b(export\s+default\s+)(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>(?!\s*\{)\s*|\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>(?!\s*\{)\s*/g;
  for (const match of content.matchAll(expressionPattern)) {
    const start = match.index ?? 0;
    const newline = content.indexOf("\n", start);
    ranges.push({ name: match[2], isDefault: Boolean(match[1]), start, end: newline < 0 ? content.length : newline });
  }
  return ranges;
}

function offsetForLine(content, line) {
  if (!line || line <= 1) return 0;
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = content.indexOf("\n", offset);
    if (next < 0) return content.length;
    offset = next + 1;
  }
  return offset;
}

function lineRange(content, offset) {
  const start = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const next = content.indexOf("\n", offset);
  return { start, end: next < 0 ? content.length : next };
}

function buildActiveSourceRanges(file, candidateLine, seedSymbols = []) {
  const content = maskCodeComments(file.content);
  const functionRanges = extractSourceExecutionRanges(content);
  const active = [];
  const add = (range) => {
    if (range && !active.some((value) => value.start === range.start && value.end === range.end)) active.push(range);
  };
  if (candidateLine) {
    const offset = offsetForLine(content, candidateLine);
    add(functionRanges.find((range) => offset >= range.start && offset < range.end) ?? lineRange(content, offset));
  }
  for (const symbol of seedSymbols) {
    add(symbol === "default"
      ? functionRanges.find((range) => range.isDefault)
      : functionRanges.find((range) => range.name === symbol));
  }
  let changed = true;
  while (changed) {
    changed = false;
    const activeText = active.map((range) => content.slice(range.start, range.end)).join("\n");
    for (const range of functionRanges) {
      if (!range.name || active.includes(range)) continue;
      if (new RegExp(`\\b${range.name.replace(/[$]/g, "\\$")}\\s*\\(`).test(activeText)) {
        active.push(range);
        changed = true;
      }
    }
  }
  return active;
}

function parseStaticModuleBinding(statement) {
  const clause = /^\s*import\s+([\s\S]*?)\s+from\s+["'`]/.exec(statement)?.[1]?.trim().replace(/^type\s+/, "");
  if (!clause) return { localSymbols: [], targetSymbols: [] };
  const localSymbols = [];
  const targetSymbols = [];
  const defaultBinding = clause.match(/^([A-Za-z_$][\w$]*)/);
  if (defaultBinding) {
    localSymbols.push(defaultBinding[1]);
    targetSymbols.push("default");
  }
  const named = clause.match(/\{([\s\S]*?)\}/)?.[1];
  for (const item of named?.split(",") ?? []) {
    const parts = item.trim().split(/\s+as\s+/);
    if (!parts[0]) continue;
    targetSymbols.push(parts[0].trim());
    localSymbols.push((parts[1] ?? parts[0]).trim());
  }
  const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespace) {
    localSymbols.push(namespace[1]);
    targetSymbols.push("default");
  }
  return { localSymbols, targetSymbols };
}

function isWordBoundary(content, offset, length) {
  const before = content[offset - 1];
  const after = content[offset + length];
  return (!before || !/[\w$]/.test(before)) && (!after || !/[\w$]/.test(after));
}

function readQuotedModuleSpecifier(content, quoteOffset) {
  const quote = content[quoteOffset];
  if (quote !== "'" && quote !== '"' && quote !== "`") return undefined;
  let specifier = "";
  for (let index = quoteOffset + 1; index < content.length; index += 1) {
    const character = content[index];
    if (character === "\\") {
      if (index + 1 >= content.length) return undefined;
      specifier += content[index + 1];
      index += 1;
      continue;
    }
    if (character === quote) return { specifier, end: index + 1 };
    if (quote === "`" && character === "$" && content[index + 1] === "{") return undefined;
    if (character === "\r" || character === "\n") return undefined;
    specifier += character;
  }
  return undefined;
}

function skipModuleWhitespace(content, offset) {
  let cursor = offset;
  while (cursor < content.length && /\s/.test(content[cursor])) cursor += 1;
  return cursor;
}

function extractModuleReferences(content) {
  const references = [];
  const add = (reference) => {
    if (!references.some((candidate) =>
      candidate.offset === reference.offset && candidate.specifier === reference.specifier
    )) references.push(reference);
  };
  for (const match of content.matchAll(/\bimport\b/g)) {
    const offset = match.index ?? 0;
    if (isOffsetInsideCodeStringOrComment(content, offset)) continue;
    let cursor = skipModuleWhitespace(content, offset + "import".length);
    if (content[cursor] === "(") {
      const literal = readQuotedModuleSpecifier(content, skipModuleWhitespace(content, cursor + 1));
      if (!literal || content[skipModuleWhitespace(content, literal.end)] !== ")") continue;
      const lineStart = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
      const local = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(content.slice(lineStart, offset))?.[1];
      add({ specifier: literal.specifier, syntax: "dynamic", offset, endOffset: skipModuleWhitespace(content, literal.end) + 1, localSymbols: local ? [local] : [], targetSymbols: ["default"] });
      continue;
    }
    const sideEffect = readQuotedModuleSpecifier(content, cursor);
    if (sideEffect) {
      add({ specifier: sideEffect.specifier, syntax: "static", offset, endOffset: sideEffect.end, localSymbols: [], targetSymbols: [] });
      continue;
    }
    let braceDepth = 0;
    while (cursor < content.length && cursor - offset <= 4_000) {
      const character = content[cursor];
      if (character === ";" && braceDepth === 0) break;
      if (character === "{" || character === "[" || character === "(") braceDepth += 1;
      else if (character === "}" || character === "]" || character === ")") braceDepth = Math.max(0, braceDepth - 1);
      if (braceDepth === 0 && content.startsWith("import", cursor) && cursor !== offset && isWordBoundary(content, cursor, 6)) break;
      if (braceDepth === 0 && content.startsWith("from", cursor) && isWordBoundary(content, cursor, 4)) {
        const literal = readQuotedModuleSpecifier(content, skipModuleWhitespace(content, cursor + 4));
        if (literal) add({
          specifier: literal.specifier,
          syntax: "static",
          offset,
          endOffset: literal.end,
          ...parseStaticModuleBinding(content.slice(offset, literal.end))
        });
        break;
      }
      cursor += 1;
    }
  }
  for (const match of content.matchAll(/\brequire\b/g)) {
    const offset = match.index ?? 0;
    if (isOffsetInsideCodeStringOrComment(content, offset)) continue;
    let cursor = skipModuleWhitespace(content, offset + "require".length);
    if (content[cursor] !== "(") continue;
    const literal = readQuotedModuleSpecifier(content, skipModuleWhitespace(content, cursor + 1));
    if (!literal || content[skipModuleWhitespace(content, literal.end)] !== ")") continue;
    const lineStart = content.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
    const local = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(content.slice(lineStart, offset))?.[1];
    add({ specifier: literal.specifier, syntax: "require", offset, endOffset: skipModuleWhitespace(content, literal.end) + 1, localSymbols: local ? [local] : [], targetSymbols: ["default"] });
  }
  return references.sort((left, right) => left.offset - right.offset);
}

function isNonActionAssetModule(specifier) {
  return /\.(?:css|scss|sass|less|styl|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)(?:[?#].*)?$/i.test(specifier);
}

function buildSourceDependencyGraph(files) {
  const codeFiles = files.filter((file) => CODE_FILE_PATTERN.test(file.path) && !isFixturePath(file.path));
  const paths = new Set(codeFiles.map((file) => normalizePath(file.path)));
  const aliasRules = buildImportAliasRules(files);
  const internalEdges = [];
  const diagnosticsByFile = new Map();
  for (const file of codeFiles) {
    const path = normalizePath(file.path);
    const content = maskCodeComments(file.content);
    for (const reference of extractModuleReferences(content)) {
      const specifier = reference.specifier;
      const relative = specifier.startsWith("./") || specifier.startsWith("../");
      const alias = relative ? undefined : resolveAliasImport(specifier, paths, aliasRules);
      const resolved = relative ? resolveRelativeImport(path, specifier, paths) : alias?.resolved;
      if (resolved) {
        const kind = relative
          ? reference.syntax === "dynamic"
            ? "dynamic_import"
            : reference.syntax === "require"
              ? "require"
              : "relative_import"
          : "path_alias";
        internalEdges.push({ from: path, to: resolved, kind, offset: reference.offset, localSymbols: reference.localSymbols, targetSymbols: reference.targetSymbols });
      } else if ((relative || alias?.potentialLocal) && !isNonActionAssetModule(specifier)) {
        const diagnostics = diagnosticsByFile.get(path) ?? [];
        diagnostics.push({
          message: alias?.diagnostic ?? `Unresolved local import: ${specifier}`,
          offset: reference.offset,
          endOffset: reference.endOffset,
          localSymbols: reference.localSymbols
        });
        diagnosticsByFile.set(path, diagnostics);
      }
    }
  }
  const routeCandidates = findImportEntrypoints(codeFiles).filter((candidate) => candidate.destination);
  for (const navigation of routeCandidates) {
    for (const route of routeCandidates) {
      if (navigation.file === route.file || !importDestinationsCompatible(navigation.destination, route.destination)) continue;
      internalEdges.push({
        from: navigation.file,
        to: route.file,
        kind: "navigation_route",
        offset: offsetForLine(codeFiles.find((file) => normalizePath(file.path) === navigation.file)?.content ?? "", navigation.line),
        localSymbols: [],
        targetSymbols: [],
        targetLine: route.line
      });
    }
  }
  return { internalEdges, diagnosticsByFile, filesByPath: new Map(codeFiles.map((file) => [normalizePath(file.path), file])) };
}

export function buildReviewSourceReachability({ sourceFiles, entrypointFiles, maxFiles = 256, maxDepth = 12 }) {
  const graph = buildSourceDependencyGraph(sourceFiles);
  const reached = new Set();
  const diagnostics = new Set();
  const relevantDiagnostics = new Set();
  const queue = entrypointFiles.map((path) => ({ path: normalizePath(path), depth: 0 }));
  let bounded = false;
  while (queue.length > 0 && reached.size < maxFiles) {
    const current = queue.shift();
    if (!current || reached.has(current.path)) continue;
    if (current.depth > maxDepth) {
      bounded = true;
      continue;
    }
    reached.add(current.path);
    for (const diagnostic of graph.diagnosticsByFile.get(current.path) ?? []) {
      diagnostics.add(diagnostic.message);
      const file = graph.filesByPath.get(current.path);
      if (file && diagnostic.localSymbols.length > 0) {
        const withoutImport = maskCodeComments(file.content.slice(0, diagnostic.offset) + " ".repeat(diagnostic.endOffset - diagnostic.offset) + file.content.slice(diagnostic.endOffset));
        if (diagnostic.localSymbols.some((symbol) => new RegExp(`(?:\\b${symbol.replace(/[$]/g, "\\$")}\\s*(?:\\.[A-Za-z_$][\\w$]*)?\\s*\\(|<\\s*${symbol.replace(/[$]/g, "\\$")}\\b)`).test(withoutImport))) relevantDiagnostics.add(diagnostic.message);
      }
    }
    for (const edge of graph.internalEdges.filter((value) => value.from === current.path)) {
      queue.push({ path: edge.to, depth: current.depth + 1 });
    }
  }
  if (queue.length > 0) bounded = true;
  return { files: [...reached], diagnostics: [...diagnostics], relevantDiagnostics: [...relevantDiagnostics], bounded };
}

function getReachableSource(graph, candidate) {
  const reached = new Set();
  const processedStates = new Set();
  const relevantDiagnostics = new Set();
  const activeRanges = new Map();
  const queue = [{ path: normalizePath(candidate.file), depth: 0, candidateLine: candidate.line, seedSymbols: [] }];
  let bounded = false;
  while (queue.length > 0 && processedStates.size < 128) {
    const current = queue.shift();
    if (!current) continue;
    const stateKey = `${current.path}:${current.candidateLine ?? 0}:${[...(current.seedSymbols ?? [])].sort().join(",")}`;
    if (processedStates.has(stateKey)) continue;
    processedStates.add(stateKey);
    if (current.depth > 8) {
      bounded = true;
      continue;
    }
    reached.add(current.path);
    const file = graph.filesByPath.get(current.path);
    if (!file) continue;
    const ranges = buildActiveSourceRanges(file, current.candidateLine, current.seedSymbols);
    const combinedRanges = [...(activeRanges.get(current.path) ?? [])];
    for (const range of ranges) {
      if (!combinedRanges.some((value) => value.start === range.start && value.end === range.end)) combinedRanges.push(range);
    }
    activeRanges.set(current.path, combinedRanges);
    const activeText = combinedRanges.map((range) => file.content.slice(range.start, range.end)).join("\n");
    for (const diagnostic of graph.diagnosticsByFile.get(current.path) ?? []) {
      const offsetReachable = combinedRanges.some((range) => diagnostic.offset >= range.start && diagnostic.offset < range.end);
      const symbolReachable = diagnostic.localSymbols.some((symbol) => new RegExp(`\\b${symbol.replace(/[$]/g, "\\$")}\\b`).test(activeText));
      if (offsetReachable || symbolReachable) relevantDiagnostics.add(diagnostic.message);
    }
    for (const edge of graph.internalEdges.filter((value) => value.from === current.path)) {
      const offsetReachable = combinedRanges.some((range) => edge.offset >= range.start && edge.offset < range.end);
      const symbolReachable = edge.localSymbols.some((symbol) => new RegExp(`\\b${symbol.replace(/[$]/g, "\\$")}\\b`).test(activeText));
      if (edge.kind !== "navigation_route" && !offsetReachable && !symbolReachable) continue;
      queue.push({ path: edge.to, depth: current.depth + 1, candidateLine: edge.targetLine, seedSymbols: edge.targetSymbols });
    }
  }
  if (queue.length > 0) bounded = true;
  const diagnostics = [...relevantDiagnostics];
  if (bounded) diagnostics.push("Import source graph exceeded its bounded traversal limit.");
  return { files: [...reached], activeRanges, diagnostics: [...new Set(diagnostics)], bounded };
}

export function buildImportReviewGraph({ sourceFiles }) {
  const entrypoints = findImportEntrypoints(sourceFiles);
  const graph = buildSourceDependencyGraph(sourceFiles);
  return entrypoints.map((entrypoint) => {
    const reachability = getReachableSource(graph, entrypoint);
    return {
      entrypoint,
      sourceFiles: reachability.files,
      resolverDiagnostics: reachability.diagnostics,
      bounded: reachability.bounded,
      activeRanges: Object.fromEntries([...reachability.activeRanges].map(([path, ranges]) => [path, ranges]))
    };
  });
}

function getPublishEntryDistFiles(publishManifest, distFiles) {
  const available = new Set(distFiles.map((file) => normalizePath(file.path)));
  const entries = Object.values(publishManifest?.entryPoints ?? {})
    .map((entry) => typeof entry?.file === "string" ? normalizePath(entry.file) : undefined)
    .filter(Boolean);
  const resolved = new Set();
  for (const entry of entries) {
    for (const path of available) {
      if (path === entry || path.endsWith(`/${entry}`)) resolved.add(path);
    }
  }
  return resolved;
}

function getReachableDistFiles(files, starts) {
  const available = new Set(files.map((file) => normalizePath(file.path)));
  const dependencies = new Map();
  for (const file of files) {
    const path = normalizePath(file.path);
    const fileDependencies = new Set();
    for (const reference of extractModuleReferences(maskCodeComments(file.content))) {
      const specifier = reference.specifier;
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
      const resolved = resolveRelativeImport(path, specifier, available);
      if (resolved) fileDependencies.add(resolved);
    }
    dependencies.set(path, fileDependencies);
  }
  const reached = new Set();
  const queue = [...starts];
  while (queue.length > 0 && reached.size < 128) {
    const current = queue.shift();
    if (!current || reached.has(current)) continue;
    reached.add(current);
    queue.push(...(dependencies.get(current) ?? []));
  }
  return reached;
}

function extractArtifactCalls(files, declarationIds, publishManifest) {
  const entryFiles = getPublishEntryDistFiles(publishManifest, files);
  const reachableFiles = entryFiles.size > 0 ? getReachableDistFiles(files, entryFiles) : new Set(files.map((file) => normalizePath(file.path)));
  const calls = [];
  for (const file of files) {
    if (!reachableFiles.has(normalizePath(file.path))) continue;
    const resolvedCalls = extractCalls([file], "dist");
    for (const declarationId of declarationIds) {
      const call = resolvedCalls.find((candidate) => candidate.declarationId === declarationId);
      if (!call || !/\bcanonical_store\b/.test(file.content)) continue;
      calls.push({ ...call, invocationKind: "artifact_marker" });
    }
  }
  return calls;
}

function findRemovedTypeShimProperties(files) {
  const findings = [];
  for (const file of files) {
    if (!CODE_FILE_PATTERN.test(file.path) || isFixturePath(file.path)) continue;
    const content = maskCodeComments(file.content);
    const pattern = /\b(?:interface|type)\s+[A-Za-z_$][\w$]*(?:ImportSessionRequest|OpenDataImportSession)[A-Za-z0-9_$]*[\s\S]{0,120}?\{([\s\S]{0,1800}?)\}/g;
    for (const match of content.matchAll(pattern)) {
      const removed = match[1].match(/\b(returnToApp|metadata)\s*[?:]/);
      if (removed) findings.push({ file: file.path, field: removed[1] });
    }
  }
  return findings;
}

function issue(code, message, file) {
  return { code, message, file };
}

export function analyzeImportSessionContract({ manifest, publishManifest, sourceFiles, distFiles }) {
  const issues = [];
  const declarations = Array.isArray(manifest?.dataIngressDeclarations)
    ? manifest.dataIngressDeclarations
    : [];
  const ids = new Set();
  const declarationEntities = new Map();

  for (const declaration of declarations) {
    if (!declaration || typeof declaration !== "object") {
      issues.push(issue("import-session-request-contract-invalid", "dataIngressDeclarations contains an incomplete item.", "plannerxchange.app.json"));
      continue;
    }
    if (!ALLOWED_INGRESS_SOURCES.has(declaration.source)) {
      issues.push(issue("import-session-request-contract-invalid", `Ingress source '${String(declaration.source)}' is not an exact supported value.`, "plannerxchange.app.json"));
    }
    if (!ALLOWED_INGRESS_TARGETS.has(declaration.target)) {
      issues.push(issue("import-session-request-contract-invalid", `Ingress target '${String(declaration.target)}' is not an exact supported value.`, "plannerxchange.app.json"));
    }
    if (!Array.isArray(declaration.dataClasses) || declaration.dataClasses.length === 0) {
      issues.push(issue("import-session-request-contract-invalid", "Every ingress declaration must include dataClasses.", "plannerxchange.app.json"));
    } else {
      for (const dataClass of declaration.dataClasses) {
        if (!ALLOWED_DATA_CLASSES.has(dataClass)) {
          issues.push(issue("import-session-request-contract-invalid", `Data class '${String(dataClass)}' is not an exact supported value.`, "plannerxchange.app.json"));
        }
      }
    }
    if (declaration.target === "px_import_session") {
      if (typeof declaration.id !== "string" || !declaration.id.trim()) {
        issues.push(issue("import-session-request-contract-invalid", "Every px_import_session declaration needs a stable non-empty id.", "plannerxchange.app.json"));
      } else if (ids.has(declaration.id)) {
        issues.push(issue("import-session-request-contract-invalid", `Duplicate import declaration id '${declaration.id}'.`, "plannerxchange.app.json"));
      } else {
        ids.add(declaration.id);
      }
      if (!Array.isArray(declaration.supportedModes) || !declaration.supportedModes.includes("canonical_store")) {
        issues.push(issue("import-session-request-contract-invalid", `Import declaration '${String(declaration.id ?? "")}' must support canonical_store.`, "plannerxchange.app.json"));
      }
      if (!Array.isArray(declaration.canonicalEntityHints) || declaration.canonicalEntityHints.length === 0) {
        issues.push(issue("import-session-request-contract-invalid", `Import declaration '${String(declaration.id ?? "")}' must declare at least one canonical entity.`, "plannerxchange.app.json"));
      } else {
        for (const entityType of declaration.canonicalEntityHints) {
          const requiredDataClass = CANONICAL_IMPORT_BY_ENTITY.get(entityType);
          if (!requiredDataClass) {
            issues.push(issue("import-session-request-contract-invalid", `Canonical import entity '${String(entityType)}' is not supported.`, "plannerxchange.app.json"));
          } else if (!declaration.dataClasses?.includes(requiredDataClass)) {
            issues.push(issue("import-session-request-contract-invalid", `Canonical import entity '${entityType}' requires data class '${requiredDataClass}'.`, "plannerxchange.app.json"));
          }
        }
        if (typeof declaration.id === "string" && declaration.id.trim()) {
          declarationEntities.set(declaration.id, new Set(declaration.canonicalEntityHints));
        }
      }
    }
  }

  const sourceCalls = extractCalls(sourceFiles, "source");
  const distCalls = extractArtifactCalls(distFiles, [...ids], publishManifest);
  for (const call of sourceCalls) {
    if (call.unresolved || !ids.has(call.declarationId)) {
      issues.push(issue("import-session-request-contract-invalid", call.unresolved ? "openDataImportSession must use a literal or file-local static declarationId." : `openDataImportSession references undeclared id '${call.declarationId}'.`, call.file));
    }
    if (call.usesRemovedProperties) {
      issues.push(issue("import-session-request-contract-invalid", "openDataImportSession includes properties outside declarationId, mode, and entityType.", call.file));
    }
  }
  for (const removedProperty of findRemovedTypeShimProperties(sourceFiles)) {
    issues.push(
      issue(
        "import-session-request-contract-invalid",
        `Import request type shim still defines removed property '${removedProperty.field}'.`,
        removedProperty.file
      )
    );
  }

  for (const declarationId of ids) {
    if (!sourceCalls.some((call) => call.declarationId === declarationId)) {
      issues.push(issue("import-session-declaration-usage-missing", `Import declaration '${declarationId}' has no matching source call.`, "plannerxchange.app.json"));
    }
    if (!distCalls.some((call) => call.declarationId === declarationId)) {
      issues.push(issue("import-session-build-artifact-missing", `Import declaration '${declarationId}' is absent from committed build output.`, "plannerxchange.app.json"));
    }
  }

  const importEntrypoints = findImportEntrypoints(sourceFiles);
  const sourceGraph = buildSourceDependencyGraph(sourceFiles);
  const evaluatedEntrypoints = importEntrypoints.map((entrypoint) => {
    const reachability = getReachableSource(sourceGraph, entrypoint);
    const reachableFiles = new Set(reachability.files);
    const matchingReachableCall = sourceCalls.find((call) => {
      if (!call.declarationId || !ids.has(call.declarationId) || !reachableFiles.has(normalizePath(call.file))) return false;
      const ranges = reachability.activeRanges.get(normalizePath(call.file)) ?? [];
      if (call.offset === undefined || !ranges.some((range) => call.offset >= range.start && call.offset < range.end)) return false;
      if (entrypoint.entityTypes.length === 0) return true;
      const declaredEntities = declarationEntities.get(call.declarationId) ?? new Set();
      return entrypoint.entityTypes.some((entityType) => declaredEntities.has(entityType));
    });
    return { entrypoint, reachability, matchingReachableCall };
  });
  const parents = evaluatedEntrypoints.map((_, index) => index);
  const find = (index) => parents[index] === index ? index : (parents[index] = find(parents[index]));
  const unite = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parents[b] = a; };
  for (let left = 0; left < evaluatedEntrypoints.length; left += 1) {
    for (let right = left + 1; right < evaluatedEntrypoints.length; right += 1) {
      const a = evaluatedEntrypoints[left];
      const b = evaluatedEntrypoints[right];
      const sameDestination = importDestinationsCompatible(a.entrypoint.destination, b.entrypoint.destination);
      const sameResolvedJourney = Boolean(
        a.matchingReachableCall?.declarationId &&
        a.matchingReachableCall.declarationId === b.matchingReachableCall?.declarationId &&
        a.reachability.files.some((file) => b.reachability.files.includes(file))
      );
      if (sameDestination || sameResolvedJourney) unite(left, right);
    }
  }
  const grouped = new Map();
  evaluatedEntrypoints.forEach((evaluation, index) => {
    const values = grouped.get(find(index)) ?? [];
    values.push(evaluation);
    grouped.set(find(index), values);
  });
  for (const evaluations of grouped.values()) {
    if (!evaluations.some((evaluation) => evaluation.matchingReachableCall)) {
      const diagnostics = [...new Set(evaluations.flatMap((evaluation) => evaluation.reachability.diagnostics))];
      const bounded = evaluations.some((evaluation) => evaluation.reachability.bounded);
      const entrypoint = evaluations[0].entrypoint;
      if (diagnostics.length > 0 || bounded) {
        issues.push(
          issue(
            "import-contract-analysis-indeterminate",
            `The import UI graph could not be resolved deterministically: ${diagnostics.join("; ")}`,
            entrypoint.file
          )
        );
        continue;
      }
      issues.push(
        issue(
          "import-entrypoint-not-integrated",
          TERMINAL_IMPORT_COPY_PATTERN.test(sourceFiles.find((file) => normalizePath(file.path) === entrypoint.file)?.content ?? "")
            ? "Import-facing UI ends in app-authored informational copy instead of launching the PX wizard."
            : "An import-facing route or control does not reach a matching openDataImportSession declaration.",
          entrypoint.file
      )
    );
    }
  }

  const actualIngressFile = sourceFiles.find((file) =>
    ACTUAL_FILE_INGRESS_PATTERN.test(file.content)
  );
  if (actualIngressFile && declarations.length === 0) {
    issues.push(
      issue(
        "undeclared-file-ingress",
        "Actual file input or parsing code requires a dataIngressDeclarations entry.",
        actualIngressFile.path
      )
    );
  }

  return issues;
}
