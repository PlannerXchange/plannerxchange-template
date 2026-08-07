const SDK_OPERATIONS = {
  listAppData: ["list", "GET", "collection"],
  getAppDataRecord: ["get", "GET", "record"],
  createAppDataRecord: ["create", "POST", "collection"],
  updateAppDataRecord: ["update", "PATCH", "record"],
  deleteAppDataRecord: ["delete", "DELETE", "record"],
};
const CREATE_FIELDS = new Set(["recordType", "title", "status", "schemaVersion", "clientUserId", "householdId", "accountId", "sourceRefs", "payload"]);
const UPDATE_FIELDS = new Set(["title", "status", "payload"]);
const QUERY_FIELDS = new Set(["limit", "cursor", "recordType", "clientUserId", "householdId", "accountId", "status"]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lineAt = (content, offset) => content.slice(0, offset).split(/\r?\n/).length;

function closingBrace(content, openBrace) {
  let depth = 0;
  let quote;
  for (let index = openBrace; index < content.length; index += 1) {
    const current = content[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if (current === "{") depth += 1;
    else if (current === "}" && --depth === 0) return index + 1;
  }
  return content.length;
}

function enclosingNamedFunction(content, offset) {
  const patterns = [
    /\b(export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    /\b(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g,
  ];
  let enclosing;
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const start = match.index ?? 0;
      if (start > offset) break;
      const open = start + match[0].lastIndexOf("{");
      const end = closingBrace(content, open);
      if (offset >= open && offset < end && (!enclosing || start >= enclosing.start)) enclosing = { name: match[2], start, end, exported: Boolean(match[1]) };
    }
  }
  return enclosing;
}

function operationIsReachable(files, fact) {
  const file = files.find((candidate) => candidate.path === fact.file);
  if (!file) return false;
  const content = maskComments(file.content);
  const enclosing = enclosingNamedFunction(content, fact.offset);
  if (!enclosing || enclosing.exported || enclosing.name === "mount") return true;
  const reference = new RegExp(`(?:\\b${escapeRegex(enclosing.name)}\\s*\\(|<${escapeRegex(enclosing.name)}\\b|on[A-Za-z]+\\s*=\\s*\\{\\s*${escapeRegex(enclosing.name)}\\s*\\})`);
  return files.some((candidate) => {
    const candidateContent = maskComments(candidate.content);
    if (candidate.path !== fact.file) return reference.test(candidateContent);
    return reference.test(candidateContent.slice(0, enclosing.start) + " ".repeat(enclosing.end - enclosing.start) + candidateContent.slice(enclosing.end));
  });
}

function maskComments(content) {
  let output = "";
  let index = 0;
  let quote;
  while (index < content.length) {
    const current = content[index];
    const next = content[index + 1];
    if (quote) {
      output += current;
      if (current === "\\") {
        output += next ?? "";
        index += 2;
        continue;
      }
      if (current === quote) quote = undefined;
      index += 1;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") {
      quote = current;
      output += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      const end = content.indexOf("\n", index);
      const stop = end < 0 ? content.length : end;
      output += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (current === "/" && next === "*") {
      const end = content.indexOf("*/", index + 2);
      const stop = end < 0 ? content.length : end + 2;
      output += content.slice(index, stop).replace(/[^\r\n]/g, " ");
      index = stop;
      continue;
    }
    output += current;
    index += 1;
  }
  return output;
}

function callEnd(content, openParen) {
  let depth = 0;
  let quote;
  for (let index = openParen; index < content.length; index += 1) {
    const current = content[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if (current === "(") depth += 1;
    else if (current === ")" && --depth === 0) return index + 1;
  }
  return Math.min(content.length, openParen + 2_000);
}

function callArguments(call) {
  const open = call.indexOf("(");
  if (open < 0) return [];
  const values = [];
  let start = open + 1;
  let depth = 0;
  let quote;
  for (let index = open + 1; index < call.length; index += 1) {
    const current = call[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if ("({[".includes(current)) depth += 1;
    else if (")} ]".replace(" ", "").includes(current)) depth -= 1;
    else if (current === "," && depth === 0) {
      values.push(call.slice(start, index).trim());
      start = index + 1;
    }
  }
  values.push(call.slice(start, -1).trim());
  return values;
}

function aliases(content, targets) {
  const output = new Map();
  const targetPattern = targets.map(escapeRegex).join("|");
  for (const match of content.matchAll(new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[A-Za-z_$][\\w$?.]*\\.\\s*(${targetPattern})\\b`, "g"))) {
    output.set(match[1], match[2]);
  }
  for (const match of content.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const binding of match[1].split(",")) {
      const parsed = new RegExp(`^\\s*(${targetPattern})(?:\\s*:\\s*([A-Za-z_$][\\w$]*))?\\s*$`).exec(binding);
      if (parsed) output.set(parsed[2] ?? parsed[1], parsed[1]);
    }
  }
  return output;
}

function objectFields(value) {
  const body = /^\s*\{([\s\S]*)\}\s*$/.exec(value)?.[1];
  if (body === undefined) return [];
  const fields = new Set();
  let start = 0;
  let depth = 0;
  let quote;
  const retain = (end) => {
    const field = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(body.slice(start, end))?.[1];
    if (field) fields.add(field);
  };
  for (let index = 0; index < body.length; index += 1) {
    const current = body[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if ("{[(".includes(current)) depth += 1;
    else if ("}])".includes(current)) depth -= 1;
    else if (current === "," && depth === 0) { retain(index); start = index + 1; }
  }
  retain(body.length);
  return [...fields].sort();
}

function resolveInputFields(expression, prefix, expectedType) {
  if (/^\s*\{/.test(expression)) return { fields: objectFields(expression), resolved: true };
  const symbol = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(expression)?.[1];
  if (!symbol) return { fields: [], resolved: false };
  const assignment = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(symbol)}(?:\\s*:\\s*${expectedType})?\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*(?:;|$)`, "g");
  let assigned;
  for (const match of prefix.matchAll(assignment)) assigned = match;
  if (assigned) return { fields: objectFields(assigned[1]), resolved: true };
  const typed = new RegExp(`\\b${escapeRegex(symbol)}\\s*:\\s*${expectedType}\\b`).test(prefix);
  return { fields: typed ? [...(expectedType === "AppDataCreateInput" ? CREATE_FIELDS : UPDATE_FIELDS)].sort() : [], resolved: typed };
}

function resolveListQueryFields(expression, prefix) {
  if (!expression) return { fields: [], resolved: true };
  if (/^\s*\{/.test(expression)) return { fields: objectFields(expression), resolved: true };
  const symbol = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(expression)?.[1];
  if (!symbol) return { fields: [], resolved: false };
  const assignment = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(symbol)}(?:\\s*:\\s*PlannerXchangeAppDataListQuery)?\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*(?:;|$)`, "g");
  let assigned;
  for (const match of prefix.matchAll(assignment)) assigned = match;
  if (assigned) return { fields: objectFields(assigned[1]), resolved: true };
  const typed = new RegExp(`\\b${escapeRegex(symbol)}\\s*:\\s*PlannerXchangeAppDataListQuery\\b`).test(prefix);
  return { fields: typed ? [...QUERY_FIELDS].sort() : [], resolved: typed };
}

function requestShape(call, prefix, mechanism, resolvedOperation) {
  const expectedType = resolvedOperation === "create" ? "AppDataCreateInput" : "AppDataUpdateInput";
  if (mechanism === "sdk") {
    if (!['create', 'update'].includes(resolvedOperation)) return { fields: [], resolved: true };
    return resolveInputFields(callArguments(call)[resolvedOperation === "create" ? 0 : 1] ?? "", prefix, expectedType);
  }
  const inlineBody = /JSON\.stringify\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(call)?.[1];
  const serialized = inlineBody !== undefined ? `{${inlineBody}}` : /JSON\.stringify\s*\(([\s\S]*?)\)\s*[,}]/.exec(call)?.[1]?.trim() ?? "";
  if (!['create', 'update'].includes(resolvedOperation)) return /^\s*\{/.test(serialized) ? { fields: objectFields(serialized), resolved: true } : { fields: [], resolved: true };
  return resolveInputFields(serialized, prefix, expectedType);
}

function lastAssignedValue(prefix, identifier) {
  return [...prefix.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(identifier)}\\s*=\\s*([^;\\n]+)`, "g"))].at(-1)?.[1]?.trim();
}

function isExplicitFunctionParameter(prefix, identifier) {
  const signatures = [...prefix.matchAll(/(?:function\s*[A-Za-z_$]*\s*|(?:async\s*)?)(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?:=>|\{)/g)];
  const parameters = signatures.at(-1)?.[1] ?? signatures.at(-1)?.[2] ?? "";
  return new RegExp(`(?:^|[,\\s])${escapeRegex(identifier)}(?:\\s*[:?=,]|$)`).test(parameters);
}

function recordIdProvenance(expression, prefix = "") {
  if (/\b(?:clientId|clientUserId|householdId|accountId|storageKey|cacheKey|key)\b|px-[a-z0-9_-]+/i.test(expression)) return "fabricated";
  if (/^\s*["'`][^$]+["'`]\s*$/.test(expression)) return "fabricated";
  const property = /\b([A-Za-z_$][\w$]*)[^,;]*?(?:\.recordId\b|\[["']recordId["']\])/.exec(expression);
  if (property) {
    const root = property[1];
    const assignment = lastAssignedValue(prefix, root);
    if (assignment && /\b(?:listAppData|getAppDataRecord|createAppDataRecord|updateAppDataRecord)\s*\(|\/app-data\b/.test(assignment)) return "server";
    if (isExplicitFunctionParameter(prefix, root) && /(?:route|params?)/i.test(root)) return "parameter";
    return "unresolved";
  }
  const identifier = /\b(appRecordId|recordId)\b/.exec(expression)?.[1];
  if (identifier) {
    if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${escapeRegex(identifier)}\\b[^}]*\\}\\s*=\\s*(?:await\\s*)?[^;\\n]*(?:listAppData|getAppDataRecord|createAppDataRecord|updateAppDataRecord)\\s*\\(`).test(prefix)) return "server";
    const assignment = lastAssignedValue(prefix, identifier);
    if (assignment) return recordIdProvenance(assignment, prefix.slice(0, Math.max(0, prefix.lastIndexOf(assignment))));
    if (isExplicitFunctionParameter(prefix, identifier)) return "parameter";
  }
  return "unresolved";
}

function operation(endpoint, method) {
  return { "collection:GET": "list", "collection:POST": "create", "record:GET": "get", "record:PATCH": "update", "record:DELETE": "delete" }[`${endpoint}:${method}`] ?? "unknown";
}

function validate(fact) {
  const issues = new Set();
  if (fact.method === "PUT") issues.add("unsupported method PUT");
  if (fact.method === "UNKNOWN" || fact.endpoint === "unknown") issues.add("dynamic request contract");
  if (fact.operation === "unknown") issues.add("route and method do not match");
  if (fact.endpoint === "record" && fact.recordIdProvenance === "fabricated") issues.add("record id is locally fabricated");
  if (fact.endpoint === "record" && fact.recordIdProvenance === "unresolved") issues.add("record id provenance is unresolved");
  if (fact.operation === "create" && fact.requestShapeResolved !== false) {
    for (const field of ["recordType", "status", "schemaVersion", "payload"]) if (!fact.requestFields.includes(field)) issues.add(`missing create field ${field}`);
    for (const field of fact.requestFields) if (!CREATE_FIELDS.has(field)) issues.add(`unsupported create field ${field}`);
  }
  if (fact.operation === "update" && fact.requestShapeResolved !== false) {
    if (!fact.requestFields.some((field) => UPDATE_FIELDS.has(field))) issues.add("update body has no mutable fields");
    for (const field of fact.requestFields) if (!UPDATE_FIELDS.has(field)) issues.add(`unsupported update field ${field}`);
  }
  if (fact.requestFields.includes("value")) issues.add("legacy value request envelope");
  if (fact.responseFields.includes("value")) issues.add("legacy top-level value response");
  if (fact.operation === "list") for (const field of fact.queryFields) if (!QUERY_FIELDS.has(field)) issues.add(`unsupported query field ${field}`);
  if (fact.operation !== "list") for (const field of fact.queryFields) issues.add(`unsupported query field ${field}`);
  return { ...fact, issues: [...issues] };
}

export function analyzeAppDataOperations(files, source) {
  const facts = [];
  for (const file of files) {
    if (!/\.(?:[cm]?[jt]sx?|html)$/i.test(file.path)) continue;
    const content = maskComments(file.content);
    const sdkAliases = aliases(content, Object.keys(SDK_OPERATIONS));
    const sdkSymbols = [...new Set([...Object.keys(SDK_OPERATIONS), ...sdkAliases.keys()])];
    for (const match of content.matchAll(new RegExp(`\\b(${sdkSymbols.map(escapeRegex).join("|")})\\s*\\(`, "g"))) {
      const symbol = sdkAliases.get(match[1]) ?? match[1];
      const [resolvedOperation, method, endpoint] = SDK_OPERATIONS[symbol];
      const open = (match.index ?? 0) + match[0].lastIndexOf("(");
      const end = callEnd(content, open);
      const call = content.slice(match.index, end);
      const prefix = content.slice(Math.max(0, (match.index ?? 0) - 4_000), match.index ?? 0);
      const shape = requestShape(call, prefix, "sdk", resolvedOperation);
      const listQuery = resolvedOperation === "list" ? resolveListQueryFields(callArguments(call)[0] ?? "", prefix) : { fields: [], resolved: true };
      const trailing = content.slice(end, end + 1_200);
      const destructuresValue = /(?:const|let|var)\s*\{\s*value\s*\}\s*=\s*(?:await\s*)?$/.test(content.slice(Math.max(0, (match.index ?? 0) - 160), match.index ?? 0));
      const fact = validate({ file: file.path, source, mechanism: "sdk", operation: resolvedOperation, method, endpoint, recordIdProvenance: endpoint === "record" ? recordIdProvenance(callArguments(call)[0] ?? "", prefix) : "none", requestFields: shape.fields, requestShapeResolved: shape.resolved, queryFields: listQuery.fields, responseFields: destructuresValue || /\b(?:body|data|record|response|result)\??\.value\b/.test(trailing) ? ["value"] : [], line: lineAt(file.content, match.index ?? 0), offset: match.index ?? 0 });
      if (!shape.resolved || !listQuery.resolved) fact.issues.push("dynamic request contract");
      facts.push(fact);
    }
    const gatewayAliases = aliases(content, ["authenticatedFetch", "requestJson", "fetch"]);
    const gatewaySymbols = [...new Set(["authenticatedFetch", "requestJson", "fetch", ...gatewayAliases.keys()])];
    const gatewayPattern = new RegExp(`\\b(?:${gatewaySymbols.map(escapeRegex).join("|")})\\s*\\(`, "g");
    for (const routeMatch of content.matchAll(/\/app-data\b/g)) {
      const routeOffset = routeMatch.index ?? 0;
      const prefix = content.slice(Math.max(0, routeOffset - 500), routeOffset);
      const candidate = [...prefix.matchAll(gatewayPattern)].at(-1);
      if (!candidate || candidate.index === undefined) continue;
      const start = Math.max(0, routeOffset - 500) + candidate.index;
      const open = content.indexOf("(", start);
      const end = callEnd(content, open);
      if (routeOffset > end) continue;
      const call = content.slice(start, end);
      const route = callArguments(call)[0] ?? "";
      const after = route.slice(route.indexOf("/app-data") + 9);
      const endpoint = /^\s*(?:["'`]|\?|$)/.test(after) ? "collection" : /\/|\$\{/.test(after) ? "record" : "unknown";
      const literalMethod = /\bmethod\s*:\s*["'`](GET|POST|PATCH|DELETE|PUT)["'`]/i.exec(call)?.[1]?.toUpperCase();
      const method = literalMethod ?? ((/\bmethod\s*:/.test(call) || /(?:\{|,)\s*method\s*(?:,|\})/.test(call)) ? "UNKNOWN" : "GET");
      const trailing = content.slice(end, end + 1_200);
      const resolvedOperation = operation(endpoint, method);
      const callPrefix = content.slice(Math.max(0, start - 4_000), start);
      const shape = requestShape(call, callPrefix, "gateway", resolvedOperation);
      if (/JSON\.stringify[\s\S]*?\{[\s\S]*?\bvalue\s*(?::|,|\})/.test(call)) shape.fields = [...new Set([...shape.fields, "value"])].sort();
      const fact = validate({ file: file.path, source, mechanism: "gateway", operation: resolvedOperation, method, endpoint, recordIdProvenance: endpoint === "record" ? recordIdProvenance(after, callPrefix) : "none", requestFields: shape.fields, requestShapeResolved: shape.resolved, queryFields: [...new Set([...route.matchAll(/[?&]([A-Za-z_$][\w$-]*)\s*=/g)].map((match) => match[1]))], responseFields: /\b(?:body|data|record|response|result)\??\.value\b/.test(trailing) ? ["value"] : [], line: lineAt(file.content, start), offset: start });
      if (!shape.resolved) fact.issues.push("dynamic request contract");
      facts.push(fact);
    }
  }
  return facts;
}

const signature = (fact) => [fact.endpoint, fact.method, fact.operation].join(":");

function diagnosticMayResolveToFile(diagnostic, file) {
  const specifier = diagnostic.slice(diagnostic.lastIndexOf(":") + 1).trim().replace(/^['"]|['"]$/g, "");
  const normalizedSpecifier = specifier.replace(/^[~@]\//, "").replace(/^\.\//, "").replace(/\\/g, "/").replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  const normalizedFile = file.replace(/\\/g, "/").replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  return normalizedSpecifier.length > 0 && (normalizedFile.endsWith(`/${normalizedSpecifier}`) || normalizedFile === normalizedSpecifier);
}

export function analyzeAppDataContract({ manifest, sourceFiles, distFiles, reachableSourceFiles, relevantResolverDiagnostics = [], traversalBounded = false }) {
  const issues = [];
  const reachable = new Set(reachableSourceFiles ?? sourceFiles.map((file) => file.path));
  const allSource = analyzeAppDataOperations(sourceFiles, "source");
  const source = allSource.filter((fact) => reachable.has(fact.file) && operationIsReachable(sourceFiles, fact));
  const unreachable = allSource.filter((fact) => !source.includes(fact));
  for (const diagnostic of relevantResolverDiagnostics) {
    if (unreachable.some((fact) => diagnosticMayResolveToFile(diagnostic, fact.file))) issues.push({ code: "app-data-analysis-indeterminate", file: "plannerxchange.app.json", message: `${diagnostic}. Configure a unique local path mapping so app-data calls can be verified.` });
  }
  if (traversalBounded && unreachable.length > 0) issues.push({ code: "app-data-analysis-indeterminate", file: "plannerxchange.app.json", message: "App-data source traversal exceeded its bounded review limit." });
  const artifact = analyzeAppDataOperations(distFiles, "dist");
  const available = new Map();
  for (const fact of artifact) {
    const provenIssues = fact.issues.filter((issue) => !/dynamic request contract|provenance is unresolved/.test(issue));
    if (provenIssues.length === 0) available.set(signature(fact), [...(available.get(signature(fact)) ?? []), fact]);
    else issues.push({ code: "app-data-request-contract-invalid", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data operation: ${provenIssues.join(", ")}.` });
  }
  for (const fact of source) {
    const unresolvedProvenance = fact.issues.includes("record id provenance is unresolved");
    const provenIssues = fact.issues.filter((issue) => issue !== "record id provenance is unresolved");
    if (provenIssues.length > 0) issues.push({ code: "app-data-request-contract-invalid", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data operation: ${provenIssues.join(", ")}.` });
    else if (unresolvedProvenance) issues.push({ code: "app-data-analysis-indeterminate", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data record ID provenance could not be resolved. Use an explicit recordId or appRecordId parameter.` });
  }
  for (const fact of source.filter((entry) => entry.issues.length === 0)) {
    const matches = available.get(signature(fact)) ?? [];
    if (matches.length > 0) matches.shift();
    else issues.push({ code: "app-data-build-artifact-missing", file: fact.file, message: `Valid ${fact.operation} app-data operation is missing from committed build output.` });
  }
  const permissions = new Set(Array.isArray(manifest?.permissions) ? manifest.permissions : []);
  if (source.some((fact) => fact.operation === "list" || fact.operation === "get") && !permissions.has("app_data.read")) issues.push({ code: "app-data-read-scope-missing", file: "plannerxchange.app.json", message: "App-data reads require app_data.read." });
  if (source.some((fact) => ["create", "update", "delete"].includes(fact.operation) || ["POST", "PATCH", "DELETE", "PUT"].includes(fact.method)) && !permissions.has("app_data.write")) issues.push({ code: "app-data-write-scope-missing", file: "plannerxchange.app.json", message: "App-data writes require app_data.write." });
  return issues;
}
