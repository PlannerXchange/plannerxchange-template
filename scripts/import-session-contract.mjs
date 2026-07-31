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
  "app_work_product"
]);

const IMPORT_ENTRYPOINT_PATTERN =
  /(?:\bimport\s+data\b|\bdata\s+import\b|\bimport\s+(?:transactions?|accounts?|positions?|csv|file)\b|\bupload\s+(?:csv|file|transactions?)\b)/i;
const TERMINAL_IMPORT_COPY_PATTERN =
  /(?:import(?:s|ing)?\s+(?:is|are)\s+managed\s+by\s+PlannerXchange|once\s+PlannerXchange\s+imports?|will\s+appear\s+automatically)/i;
const IMPORT_CALL_PATTERN = /\bopenDataImportSession\s*\(\s*\{([\s\S]{0,1800}?)\}\s*\)/g;

function resolveStaticStrings(content) {
  const values = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`\r\n]+)\2/g;
  for (const match of content.matchAll(pattern)) {
    values.set(match[1], match[3]);
  }
  return values;
}

function extractCalls(files, source) {
  const calls = [];
  for (const file of files) {
    const staticStrings = resolveStaticStrings(file.content);
    for (const match of file.content.matchAll(IMPORT_CALL_PATTERN)) {
      const body = match[1];
      const literal = body.match(/\bdeclarationId\s*:\s*(["'`])([^"'`\r\n]+)\1/);
      const identifier = body.match(/\bdeclarationId\s*:\s*([A-Za-z_$][\w$]*)/);
      const declarationId = literal?.[2] ?? (identifier ? staticStrings.get(identifier[1]) : undefined);
      calls.push({
        source,
        file: file.path,
        declarationId,
        unresolved: !declarationId,
        usesRemovedProperties:
          new RegExp(`\\b(?:${"returnTo" + "App"}|${"meta" + "data"})\\s*:`).test(body)
      });
    }
  }
  return calls;
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
    }
  }

  const sourceCalls = extractCalls(sourceFiles, "source");
  const distCalls = extractCalls(distFiles, "dist");
  for (const call of sourceCalls) {
    if (call.unresolved || !ids.has(call.declarationId)) {
      issues.push(issue("import-session-request-contract-invalid", call.unresolved ? "openDataImportSession must use a literal or file-local static declarationId." : `openDataImportSession references undeclared id '${call.declarationId}'.`, call.file));
    }
    if (call.usesRemovedProperties) {
      issues.push(issue("import-session-request-contract-invalid", "openDataImportSession includes properties outside declarationId, mode, and entityType.", call.file));
    }
  }

  for (const declarationId of ids) {
    if (!sourceCalls.some((call) => call.declarationId === declarationId)) {
      issues.push(issue("import-session-declaration-usage-missing", `Import declaration '${declarationId}' has no matching source call.`, "plannerxchange.app.json"));
    }
    if (!distCalls.some((call) => call.declarationId === declarationId)) {
      issues.push(issue("import-session-build-artifact-missing", `Import declaration '${declarationId}' is absent from committed build output.`, "plannerxchange.app.json"));
    }
  }

  const importEntrypoints = sourceFiles.filter((file) => IMPORT_ENTRYPOINT_PATTERN.test(file.content));
  if (importEntrypoints.length > 0 && sourceCalls.length === 0) {
    issues.push(issue("import-entrypoint-not-integrated", "An import-facing route or control does not reach openDataImportSession.", importEntrypoints[0].path));
  }
  for (const file of importEntrypoints) {
    if (TERMINAL_IMPORT_COPY_PATTERN.test(file.content) && !/\bopenDataImportSession\s*\(/.test(file.content)) {
      issues.push(issue("import-entrypoint-not-integrated", "Import-facing UI ends in app-authored informational copy instead of launching the PX wizard.", file.path));
    }
  }

  return issues;
}
