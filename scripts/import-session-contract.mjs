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
const RELATIVE_IMPORT_PATTERN =
  /\b(?:from\s+["'`](\.{1,2}\/[^"'`]+)["'`]|import\(\s*["'`](\.{1,2}\/[^"'`]+)["'`]\s*\)|require\(\s*["'`](\.{1,2}\/[^"'`]+)["'`]\s*\))/g;
const ACTUAL_FILE_INGRESS_PATTERN =
  /(?:<input\b[^>]*\btype\s*=\s*["']file["']|\bFileReader\b|\bXLSX\s*\.\s*read\s*\(|\breadFile\s*\(|\bsheet_to_json\s*\(|\bPapa\s*\.\s*parse\s*\(|\b(?:onDrop|dropzone|DataTransfer\.files)\b)/i;

function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
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
    const staticStrings = resolveStaticStrings(file.content);
    const helperSymbols = resolveImportHelperSymbols(file.content);
    for (const match of file.content.matchAll(IMPORT_CALL_PATTERN)) {
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
        usesRemovedProperties:
          new RegExp(`\\b(?:${"returnTo" + "App"}|${"meta" + "data"})\\s*:`).test(body)
      });
    }
  }
  return calls;
}

function extractArtifactCalls(files, declarationIds) {
  const calls = [];
  for (const file of files) {
    for (const declarationId of declarationIds) {
      if (
        file.content.includes(declarationId) &&
        /\bopenDataImportSession\b/.test(file.content) &&
        /\bcanonical_store\b/.test(file.content)
      ) {
        calls.push({
          source: "dist",
          file: file.path,
          declarationId,
          unresolved: false,
          invocationKind: "artifact_marker",
          usesRemovedProperties: false
        });
      }
    }
  }
  return calls;
}

function resolveRelativeImport(importerPath, specifier, availablePaths) {
  const importerParts = normalizePath(importerPath).split("/");
  importerParts.pop();
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") importerParts.pop();
    else importerParts.push(part);
  }
  const base = importerParts.join("/");
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`
  ].find((candidate) => availablePaths.has(candidate));
}

function buildSourceDependencyGraph(files) {
  const paths = new Set(files.map((file) => normalizePath(file.path)));
  const graph = new Map();
  for (const file of files) {
    const dependencies = new Set();
    for (const match of file.content.matchAll(RELATIVE_IMPORT_PATTERN)) {
      const resolved = resolveRelativeImport(
        file.path,
        match[1] ?? match[2] ?? match[3],
        paths
      );
      if (resolved) dependencies.add(resolved);
    }
    graph.set(normalizePath(file.path), dependencies);
  }
  return graph;
}

function getReachableFiles(graph, start) {
  const reached = new Set();
  const queue = [{ path: normalizePath(start), depth: 0 }];
  while (queue.length > 0 && reached.size < 64) {
    const current = queue.shift();
    if (!current || reached.has(current.path) || current.depth > 8) continue;
    reached.add(current.path);
    for (const dependency of graph.get(current.path) ?? []) {
      queue.push({ path: dependency, depth: current.depth + 1 });
    }
  }
  return reached;
}

function findImportEntrypoints(files) {
  const entrypoints = [];
  for (const file of files) {
    for (const line of file.content.split(/\r?\n/)) {
      if (!IMPORT_ENTRYPOINT_PATTERN.test(line)) continue;
      const matches = [];
      for (const [entityType, , aliases] of CANONICAL_IMPORT_ENTITY_CATALOG) {
        for (const alias of aliases) {
          const match = new RegExp(`\\b(?:import|upload)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").exec(line);
          if (match) matches.push({ entityType, index: match.index, length: match[0].length });
        }
      }
      entrypoints.push({
        ...file,
        entrypointText: line,
        entityTypes: [...new Set(matches
          .filter((candidate) => !matches.some((other) => other.index === candidate.index && other.length > candidate.length))
          .map((candidate) => candidate.entityType))]
      });
    }
  }
  return entrypoints;
}

function findRemovedTypeShimProperties(files) {
  const findings = [];
  for (const file of files) {
    const pattern = /\b(?:interface|type)\s+[A-Za-z_$][\w$]*(?:ImportSessionRequest|OpenDataImportSession)[A-Za-z0-9_$]*[\s\S]{0,120}?\{([\s\S]{0,1800}?)\}/g;
    for (const match of file.content.matchAll(pattern)) {
      const removed = match[1].match(/\b(returnToApp|metadata)\s*[?:]/);
      if (removed) findings.push({ file: file.path, field: removed[1] });
    }
  }
  return findings;
}

function issue(code, message, file) {
  return { code, message, file };
}

export function analyzeImportSessionContract({ manifest, sourceFiles, distFiles }) {
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
  const distCalls = extractArtifactCalls(distFiles, [...ids]);
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
  for (const file of importEntrypoints) {
    const reachableFiles = getReachableFiles(sourceGraph, file.path);
    const matchingReachableCall = sourceCalls.find((call) => {
      if (!call.declarationId || !ids.has(call.declarationId) || !reachableFiles.has(normalizePath(call.file))) return false;
      if (file.entityTypes.length === 0) return true;
      const declaredEntities = declarationEntities.get(call.declarationId) ?? new Set();
      return file.entityTypes.some((entityType) => declaredEntities.has(entityType));
    });
    if (!matchingReachableCall) {
      issues.push(
        issue(
          "import-entrypoint-not-integrated",
          TERMINAL_IMPORT_COPY_PATTERN.test(file.content)
            ? "Import-facing UI ends in app-authored informational copy instead of launching the PX wizard."
            : "An import-facing route or control does not reach a matching openDataImportSession declaration.",
          file.path
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
