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

function normalizeSourcePath(value) {
  const parts = [];
  for (const part of value.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/").replace(/\.(?:[cm]?[jt]sx?|json)$/i, "").replace(/\/index$/i, "");
}

function localImportCandidates(importerPath, moduleSpecifier, files) {
  if (moduleSpecifier.startsWith("@plannerxchange/")) return [];
  const importerDirectory = normalizeSourcePath(importerPath).split("/").slice(0, -1).join("/");
  const target = moduleSpecifier.startsWith(".")
    ? normalizeSourcePath(`${importerDirectory}/${moduleSpecifier}`)
    : normalizeSourcePath(
        moduleSpecifier.startsWith("@/") || moduleSpecifier.startsWith("~/")
          ? moduleSpecifier.slice(2)
          : moduleSpecifier.startsWith("@") && moduleSpecifier.includes("/")
            ? moduleSpecifier.slice(moduleSpecifier.indexOf("/") + 1)
            : moduleSpecifier
      );
  return files.filter((candidate) => {
    const candidatePath = normalizeSourcePath(candidate.path);
    return moduleSpecifier.startsWith(".")
      ? candidatePath === target
      : candidatePath === target || candidatePath.endsWith(`/${target}`);
  });
}

function relevantTypeSources(current, files) {
  const selected = new Map();
  const queue = [current];
  const visited = new Set([current.path]);
  while (queue.length > 0 && visited.size <= 32) {
    const importer = queue.shift();
    for (const match of importer.content.matchAll(/\bimport\s+(?:type\s+)?(?:\{[\s\S]*?\}|[A-Za-z_$][\w$]*(?:\s*,\s*\{[\s\S]*?\})?)\s+from\s+["']([^"']+)["']/g)) {
      for (const candidate of localImportCandidates(importer.path, match[1], files)) {
        if (candidate.path === current.path || visited.has(candidate.path)) continue;
        selected.set(candidate.path, candidate);
        visited.add(candidate.path);
        queue.push(candidate);
      }
    }
  }
  return [...selected.values()].map((candidate) => maskComments(candidate.content));
}

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

function resolveStaticRouteExpression(expression, prefix) {
  const trimmed = expression.trim();
  if (!trimmed || /=>/.test(trimmed)) return undefined;
  const literal = /^(?:["'`]([^"'`]*)["'`])$/.exec(trimmed)?.[1];
  if (literal !== undefined) return literal;
  let depth = 0;
  let routeLiteral;
  let routeLiteralStart = -1;
  for (let index = 0; index < trimmed.length; index += 1) {
    const current = trimmed[index];
    if (current === '"' || current === "'" || current === "`") {
      const end = trimmed.indexOf(current, index + 1);
      if (end < 0) return undefined;
      const value = trimmed.slice(index + 1, end);
      if (depth === 0 && value.includes("/app-data")) {
        routeLiteral = value;
        routeLiteralStart = index;
        break;
      }
      index = end;
    } else if ("([{".includes(current)) depth += 1;
    else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
  }
  if (routeLiteral !== undefined) {
    const prefixMarker = trimmed.slice(0, routeLiteralStart).includes("+") ? "${dynamic}" : "";
    const suffixMarker = trimmed.slice(routeLiteralStart + routeLiteral.length + 2).includes("+") ? "${dynamic}" : "";
    return `${prefixMarker}${routeLiteral}${suffixMarker}`;
  }
  const identifier = /^([A-Za-z_$][\w$]*)$/.exec(trimmed)?.[1];
  if (!identifier) return undefined;
  const assignments = [...prefix.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(identifier)}\\s*=\\s*(["'\`])([^"'\`]*)\\1`, "g"))];
  return assignments.at(-1)?.[2];
}

function gatewayCallCandidates(content) {
  const candidates = [];
  for (const match of content.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*(?:(?:\?\.)?\.[A-Za-z_$][\w$]*)*)\s*\(/g)) {
    const start = match.index ?? 0;
    const open = start + match[0].lastIndexOf("(");
    const end = callEnd(content, open);
    const call = content.slice(start, end);
    const route = callArguments(call)[0] ?? "";
    const routeValue = resolveStaticRouteExpression(route, content.slice(0, start));
    if (routeValue?.includes("/app-data")) candidates.push({ symbol: match[1], start, end, call, route, routeValue });
  }
  return candidates;
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

function importBindings(content) {
  const output = new Map();
  for (const match of content.matchAll(/\bimport\s*\{([\s\S]*?)\}\s*from\s*["'`][^"'`]+["'`]/g)) {
    for (const item of match[1].split(",")) {
      const parsed = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(item);
      if (parsed) output.set(parsed[2] ?? parsed[1], parsed[1]);
    }
  }
  return output;
}

function adapterBindings(files) {
  const codeFiles = files.filter((file) => /\.(?:[cm]?[jt]sx?|html)$/i.test(file.path));
  const masked = new Map(codeFiles.map((file) => [file.path, maskComments(file.content)]));
  const definitions = [];
  for (const file of codeFiles) {
    const content = masked.get(file.path);
    for (const match of content.matchAll(/\b(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)) {
      const start = match.index ?? 0;
      const bodyStart = start + match[0].lastIndexOf("{");
      definitions.push({ file: file.path, name: match[1], params: match[2].split(",").map((value) => value.replace(/[?:].*$/s, "").trim()).filter(Boolean), start, bodyStart, end: closingBrace(content, bodyStart), content });
    }
  }
  const byName = new Map();
  for (const definition of definitions) byName.set(definition.name, [...(byName.get(definition.name) ?? []), definition]);
  const bindings = new Map(codeFiles.map((file) => [file.path, new Set(["authenticatedFetch", "requestJson", "fetch"])]));
  const forwarded = new Map();
  const expressionUses = (expression, symbols) => /\.\s*authenticatedFetch\b/.test(expression) || [...symbols].some((symbol) => new RegExp(`\\b${escapeRegex(symbol)}\\b`).test(expression));
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const file of codeFiles) {
      const content = masked.get(file.path);
      const symbols = bindings.get(file.path);
      const imported = importBindings(content);
      for (const [local, importedName] of imported) {
        const targets = byName.get(importedName) ?? [];
        if (targets.length === 1 && bindings.get(targets[0].file)?.has(targets[0].name) && !symbols.has(local)) {
          symbols.add(local);
          changed = true;
        }
      }
      for (const match of content.matchAll(/(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*=\s*([^;\r\n]+)/g)) {
        const definition = definitions.find((candidate) => candidate.file === file.path && (match.index ?? 0) >= candidate.bodyStart && (match.index ?? 0) < candidate.end);
        const forwardedParams = definition ? forwarded.get(definition) ?? new Set() : new Set();
        if (!expressionUses(match[2], symbols) && ![...forwardedParams].some((param) => new RegExp(`\\b${escapeRegex(param)}\\b`).test(match[2]))) continue;
        if (!symbols.has(match[1])) {
          symbols.add(match[1]);
          changed = true;
        }
      }
    }
    for (const file of codeFiles) {
      const content = masked.get(file.path);
      const symbols = bindings.get(file.path);
      const imported = importBindings(content);
      for (const match of content.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
        const targetName = imported.get(match[1]) ?? match[1];
        const targets = byName.get(targetName) ?? [];
        if (targets.length !== 1) continue;
        const target = targets[0];
        if (target.file === file.path && (match.index ?? 0) >= target.start && (match.index ?? 0) <= target.bodyStart) continue;
        const open = (match.index ?? 0) + match[0].lastIndexOf("(");
        const end = callEnd(content, open);
        const args = callArguments(content.slice(match.index, end));
        args.forEach((argument, index) => {
          if (!target.params[index] || !expressionUses(argument, symbols)) return;
          const params = forwarded.get(target) ?? new Set();
          if (!params.has(target.params[index])) {
            params.add(target.params[index]);
            forwarded.set(target, params);
            changed = true;
          }
        });
      }
    }
    for (const definition of definitions) {
      const symbols = bindings.get(definition.file);
      const body = definition.content.slice(definition.bodyStart, definition.end);
      const params = forwarded.get(definition) ?? new Set();
      if (!expressionUses(body, symbols) && ![...params].some((param) => new RegExp(`\\b${escapeRegex(param)}\\s*\\(`).test(body))) continue;
      if (!/\breturn\b/.test(body) || symbols.has(definition.name)) continue;
      symbols.add(definition.name);
      changed = true;
    }
    if (!changed) break;
  }
  return bindings;
}

function scanAssignments(content) {
  const output = [];
  for (const match of content.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*=\s*(?!=|>)/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let quote;
    let end = content.length;
    for (let index = start; index < content.length; index += 1) {
      const current = content[index];
      if (quote) {
        if (current === "\\") index += 1;
        else if (current === quote) quote = undefined;
        continue;
      }
      if (current === '"' || current === "'" || current === "`") quote = current;
      else if ("([{".includes(current)) depth += 1;
      else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
      else if (depth === 0 && (current === "," || current === ";" || current === "\n" || current === "\r")) { end = index; break; }
    }
    output.push({ target: match[1], expression: content.slice(start, end).trim(), offset: match.index ?? 0 });
  }
  return output;
}

function resolveAdapterSymbol(files, filePath, invocationSymbol) {
  const codeFiles = files.filter((file) => /\.(?:[cm]?[jt]sx?|html)$/i.test(file.path));
  const records = new Map(codeFiles.map((file) => [file.path, { ...file, masked: maskComments(file.content) }]));
  const definitions = [];
  for (const file of codeFiles) {
    const content = records.get(file.path).masked;
    const patterns = [
      /(?<![A-Za-z0-9_$])(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::\s*[^={]+)?\{/g,
      /(?<![A-Za-z0-9_$])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?::\s*[^=]+)?=>\s*\{/g,
    ];
    for (const pattern of patterns) for (const match of content.matchAll(pattern)) {
      const start = match.index ?? 0;
      const bodyStart = start + match[0].lastIndexOf("{");
      definitions.push({ file: file.path, name: match[1], params: (match[2] ?? match[3] ?? "").split(",").map((value) => value.replace(/[?:=].*$/s, "").trim()).filter(Boolean), start, bodyStart, end: closingBrace(content, bodyStart), content });
    }
  }
  const assignments = new Map(codeFiles.map((file) => [file.path, scanAssignments(records.get(file.path).masked)]));
  const containing = (file, offset) => definitions.filter((definition) => definition.file === file && offset >= definition.bodyStart && offset < definition.end).sort((a, b) => b.start - a.start)[0];
  const visited = new Set();
  const identifiers = (expression) => [...new Set([...expression.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)(?![A-Za-z0-9_$])/g)].map((match) => match[1]))]
    .filter((symbol) => !new Set(["async", "await", "false", "new", "null", "return", "true", "undefined", "void"]).has(symbol))
    .reverse();
  const resolveExpression = (file, expression, scope, depth) => {
    if (depth > 20) return false;
    if (/(?:\.|\[\s*["'])authenticatedFetch(?:\b|["']\s*\])/.test(expression)) return true;
    for (const root of ["authenticatedFetch", "requestJson", "fetch"]) {
      if (!scope?.params.includes(root) && new RegExp(`(?:^|[^\\w$])${root}(?![\\w$])`).test(expression)) return true;
    }
    for (const identifier of identifiers(expression)) {
      const parameterIndex = scope?.params.indexOf(identifier) ?? -1;
      if (scope && parameterIndex >= 0) {
        for (const caller of codeFiles) {
          const record = records.get(caller.path);
          const imported = importBindings(record.masked);
          for (const call of record.masked.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g)) {
            if ((imported.get(call[1]) ?? call[1]) !== scope.name) continue;
            const offset = call.index ?? 0;
            if (caller.path === scope.file && offset >= scope.start && offset <= scope.bodyStart) continue;
            const open = offset + call[0].lastIndexOf("(");
            const end = callEnd(record.masked, open);
            const argument = callArguments(record.masked.slice(offset, end))[parameterIndex];
            if (argument && resolveExpression(caller.path, argument, containing(caller.path, offset), depth + 1)) return true;
          }
        }
      }
      if (resolveSymbol(file, identifier, scope, depth + 1)) return true;
    }
    return false;
  };
  const resolveSymbol = (file, symbol, scope, depth) => {
    if (depth > 20) return false;
    const key = `${file}:${scope?.start ?? "module"}:${symbol}`;
    if (visited.has(key)) return false;
    visited.add(key);
    for (const assignment of (assignments.get(file) ?? []).filter((candidate) => candidate.target === symbol).sort((a, b) => b.offset - a.offset)) {
      const assignmentScope = containing(file, assignment.offset);
      if (scope && assignmentScope?.start !== scope.start) continue;
      if (resolveExpression(file, assignment.expression, assignmentScope ?? scope, depth + 1)) return true;
    }
    for (const wrapper of definitions.filter((definition) => definition.file === file && definition.name === symbol)) {
      if (resolveExpression(file, wrapper.content.slice(wrapper.bodyStart, wrapper.end), wrapper, depth + 1)) return true;
    }
    return false;
  };
  return resolveSymbol(filePath, invocationSymbol.split(".").at(-1), undefined, 0);
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

function resolveListQueryFields(expression, prefix, typeSources = []) {
  return resolveAppDataRequestShape({ expression, source: prefix, typeSources, kind: "list" });
}

function requestShape(call, prefix, mechanism, resolvedOperation, typeSources = []) {
  if (mechanism === "sdk") {
    if (!['create', 'update'].includes(resolvedOperation)) return { fields: [], requiredFields: [], resolved: true, provenance: "literal_object", issues: [] };
    return resolveAppDataRequestShape({ expression: callArguments(call)[resolvedOperation === "create" ? 0 : 1] ?? "", source: prefix, typeSources, kind: resolvedOperation });
  }
  const stringify = /JSON\.stringify\s*\(/.exec(call);
  const stringifyOpen = stringify ? (stringify.index ?? 0) + stringify[0].lastIndexOf("(") : -1;
  const serialized = stringifyOpen >= 0 ? callArguments(call.slice(stringify.index ?? 0, callEnd(call, stringifyOpen)))[0] ?? "" : "";
  if (!['create', 'update'].includes(resolvedOperation)) return /^\s*\{/.test(serialized)
    ? resolveAppDataRequestShape({ expression: serialized, source: prefix, typeSources, kind: "create" })
    : { fields: [], requiredFields: [], resolved: true, provenance: "literal_object", issues: [] };
  return resolveAppDataRequestShape({ expression: serialized, source: prefix, typeSources, kind: resolvedOperation });
}

function queryValueIssues(route, prefix) {
  const issues = [];
  const directLimit = /[?&]limit=([^&"'`}]*)/.exec(route)?.[1]?.trim();
  if (directLimit && /^\d+(?:\.\d+)?$/.test(directLimit) && (!Number.isInteger(Number(directLimit)) || Number(directLimit) <= 0)) issues.push("limit must be a positive integer");
  for (const match of route.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\.toString\s*\(\s*\)\s*\}/g)) {
    const value = [...prefix.matchAll(new RegExp(`(?<![A-Za-z0-9_$])(?:const|let|var)\\s+${escapeRegex(match[1])}\\s*=\\s*new\\s+URLSearchParams\\s*\\(\\s*(\\{[^;]*?\\})\\s*\\)`, "g"))].at(-1)?.[1];
    if (value) issues.push(...resolveAppDataRequestShape({ expression: value, source: prefix, kind: "list" }).issues);
  }
  return [...new Set(issues)];
}

function requestFieldOffsets(call, fields, callStart) {
  const offsets = {};
  for (const field of fields) {
    const match = new RegExp(`(?:^|[,{])\\s*(?:["']${escapeRegex(field)}["']|${escapeRegex(field)})\\s*(?::|[,}])`).exec(call);
    if (match) {
      const within = match[0].search(new RegExp(`(?:["']${escapeRegex(field)}["']|\\b${escapeRegex(field)}\\b)`));
      offsets[field] = callStart + (match.index ?? 0) + Math.max(0, within);
    }
  }
  return offsets;
}

function queryFields(route, prefix = "") {
  const fields = new Set([...route.matchAll(/[?&]([A-Za-z_$][\w$-]*)\s*=/g)].map((match) => match[1]));
  for (const match of route.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\.toString\s*\(\s*\)\s*\}/g)) {
    const assignments = [...prefix.matchAll(new RegExp(
      `(?<![A-Za-z0-9_$])(?:const|let|var)\\s+${escapeRegex(match[1])}\\s*=\\s*new\\s+URLSearchParams\\s*\\(\\s*(\\{[^;]*?\\})\\s*\\)`,
      "g",
    ))];
    const value = assignments.at(-1)?.[1];
    if (value) for (const field of objectFields(value)) fields.add(field);
  }
  return [...fields].sort();
}

function lastAssignedValue(prefix, identifier) {
  const match = [...prefix.matchAll(new RegExp(`(?<![A-Za-z0-9_$])(?:const|let|var)?\\s*${escapeRegex(identifier)}\\s*=\\s*(?!=|>)`, "g"))].at(-1);
  if (!match) return undefined;
  const start = (match.index ?? 0) + match[0].length;
  let depth = 0;
  let quote;
  for (let index = start; index < prefix.length; index += 1) {
    const current = prefix[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if ("([{".includes(current)) depth += 1;
    else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && (current === "," || current === ";" || current === "\n" || current === "\r")) return prefix.slice(start, index).trim();
  }
  return prefix.slice(start).trim();
}

function isExplicitFunctionParameter(prefix, identifier) {
  const signatures = [...prefix.matchAll(/(?:function\s*[A-Za-z_$]*\s*|(?:async\s*)?)(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?:=>|\{)/g)];
  const parameters = signatures.at(-1)?.[1] ?? signatures.at(-1)?.[2] ?? "";
  return new RegExp(`(?:^|[,\\s])${escapeRegex(identifier)}(?:\\s*[:?=,]|$)`).test(parameters);
}

function localFunctionDefinition(prefix, symbol) {
  const pattern = new RegExp(
    `(?<![A-Za-z0-9_$])(?:async\\s+)?function\\s+${escapeRegex(symbol)}\\s*(?:<[^{}()]*>)?\\s*\\(([^)]*)\\)\\s*(?::\\s*[^={]+)?\\s*\\{`,
    "g"
  );
  const match = [...prefix.matchAll(pattern)].at(-1);
  if (!match) return undefined;
  const start = match.index ?? 0;
  const openBrace = start + match[0].lastIndexOf("{");
  const end = closingBrace(prefix, openBrace);
  if (end <= openBrace) return undefined;
  return {
    parameters: (match[1] ?? "").split(",")
      .map((parameter) => /([A-Za-z_$][A-Za-z0-9_$]*)/.exec(parameter.trim())?.[1])
      .filter(Boolean),
    body: prefix.slice(openBrace + 1, end - 1),
    bodyOffset: openBrace + 1
  };
}

function returnedExpressions(body) {
  const results = [];
  for (const match of body.matchAll(/(?<![A-Za-z0-9_$])return(?![A-Za-z0-9_$])/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 0;
    let quote;
    for (let index = start; index <= body.length; index += 1) {
      const current = body[index];
      if (quote) {
        if (current === "\\") index += 1;
        else if (current === quote) quote = undefined;
        continue;
      }
      if (current === '"' || current === "'" || current === "`") quote = current;
      else if ("([{ ".trim().includes(current)) depth += 1;
      else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
      else if ((current === ";" || current === undefined) && depth === 0) {
        const expression = body.slice(start, index).trim();
        if (expression) results.push({ expression, offset: start });
        break;
      }
    }
  }
  return results;
}

function localInvocationArguments(expression, symbol) {
  const match = new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(symbol)}\\s*(?:<[^(){};]*>)?\\s*\\(`).exec(expression);
  if (!match) return undefined;
  const openParen = (match.index ?? 0) + match[0].lastIndexOf("(");
  return callArguments(expression.slice(match.index ?? 0, callEnd(expression, openParen)));
}

function expressionComesFromAppData(expression, prefix, visited = new Set(), depth = 0) {
  if (depth > 12) return false;
  if (/\b(?:listAppData|getAppDataRecord|createAppDataRecord|updateAppDataRecord)\s*\(|["'`]\/app-data(?:[/?"'`]|$)/.test(expression)) return true;
  const mapGet = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\.\s*get\s*\(/.exec(expression)?.[1];
  if (mapGet) {
    const setCalls = [...prefix.matchAll(new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(mapGet)}\\s*\\.\\s*set\\s*\\(`, "g"))];
    for (const setCall of setCalls.reverse()) {
      const open = (setCall.index ?? 0) + setCall[0].lastIndexOf("(");
      const end = callEnd(prefix, open);
      const stored = callArguments(prefix.slice(Math.max(0, open - mapGet.length - 5), end))[1];
      if (stored && expressionComesFromAppData(stored, prefix.slice(0, setCall.index ?? 0), visited, depth + 1)) return true;
    }
  }
  const ignored = new Set(["await", "return", "const", "let", "var", "new", "undefined", "null", "true", "false", "recordId", "items", "payload", "json"]);
  for (const match of expression.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)(?![A-Za-z0-9_$])/g)) {
    const symbol = match[1];
    if (ignored.has(symbol) || visited.has(symbol)) continue;
    const nextVisited = new Set(visited).add(symbol);
    const assigned = lastAssignedValue(prefix, symbol);
    if (assigned && expressionComesFromAppData(assigned, prefix, nextVisited, depth + 1)) return true;
    const helper = localFunctionDefinition(prefix, symbol);
    const invocationArguments = localInvocationArguments(expression, symbol);
    if (helper && invocationArguments) {
      for (const returned of returnedExpressions(helper.body)) {
        const helperPrefix = prefix.slice(0, helper.bodyOffset) + helper.body.slice(0, returned.offset);
        if (expressionComesFromAppData(returned.expression, helperPrefix, nextVisited, depth + 1)) return true;
        for (let index = 0; index < helper.parameters.length; index += 1) {
          const parameter = helper.parameters[index];
          if (!new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(parameter)}(?![A-Za-z0-9_$])`).test(returned.expression)) continue;
          const argument = invocationArguments[index];
          if (argument && expressionComesFromAppData(argument, prefix, nextVisited, depth + 1)) return true;
        }
      }
    }
  }
  return false;
}

function recordIdProvenance(expression, prefix = "", visited = new Set()) {
  if (expressionComesFromAppData(expression, prefix)) return "server";
  if (/\b(?:clientId|clientUserId|householdId|accountId|storageKey|cacheKey|key)\b|px-[a-z0-9_-]+/i.test(expression)) return "fabricated";
  if (/^\s*["'`][^$]+["'`]\s*$/.test(expression)) return "fabricated";
  const property = /\b([A-Za-z_$][\w$]*)\??(?:\.recordId\b|\[["']recordId["']\])/.exec(expression);
  if (property) {
    const root = property[1];
    const assignment = lastAssignedValue(prefix, root);
    if (expressionComesFromAppData(expression, prefix) || (assignment && expressionComesFromAppData(assignment, prefix))) return "server";
    if (isExplicitFunctionParameter(prefix, root) && /(?:route|params?)/i.test(root)) return "parameter";
    return "unresolved";
  }
  const identifier = /\b(appRecordId|recordId)\b/.exec(expression)?.[1];
  if (identifier) {
    if (new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${escapeRegex(identifier)}\\b[^}]*\\}\\s*=\\s*(?:await\\s*)?[^;\\n]*(?:listAppData|getAppDataRecord|createAppDataRecord|updateAppDataRecord)\\s*\\(`).test(prefix)) return "server";
    const assignment = lastAssignedValue(prefix, identifier);
    if (assignment) return recordIdProvenance(
      assignment,
      prefix.slice(0, Math.max(0, prefix.lastIndexOf(assignment))),
      new Set(visited).add(identifier)
    );
    if (isExplicitFunctionParameter(prefix, identifier)) return "parameter";
  }
  const ignored = new Set(["await", "encodeURIComponent", "get", "return", "undefined", "null", "true", "false"]);
  for (const match of expression.matchAll(/(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)(?![A-Za-z0-9_$])/g)) {
    const symbol = match[1];
    if (ignored.has(symbol) || visited.has(symbol)) continue;
    const assignment = lastAssignedValue(prefix, symbol);
    if (!assignment) continue;
    if (expressionComesFromAppData(assignment, prefix)) return "server";
    const offset = prefix.lastIndexOf(assignment);
    const resolved = recordIdProvenance(
      assignment,
      offset >= 0 ? prefix.slice(0, offset) : prefix,
      new Set(visited).add(symbol)
    );
    if (resolved !== "unresolved") return resolved;
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

function legacyValueResponse(content, start, end) {
  const prefix = content.slice(Math.max(0, start - 240), start);
  const assignment = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s*)?(?:[A-Za-z_$][\w$]*\.)?$/.exec(prefix);
  const trailing = content.slice(end, end + 1_200);
  if (!assignment) return /^\s*(?:\?\.)?\.value\b/.test(trailing);
  const response = assignment[1];
  if (new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(response)}\\?*\\.value\\b`).test(trailing)) return true;
  const parsed = [...trailing.matchAll(new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s*)?${escapeRegex(response)}\\.json\\s*\\(`, "g"))].map((match) => match[1]);
  if (parsed.some((symbol) => new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(symbol)}\\?*\\.value\\b`).test(trailing))) return true;
  return new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\bvalue\\b[^}]*\\}\\s*=\\s*${escapeRegex(response)}\\b`).test(trailing);
}

export function analyzeAppDataOperations(files, source) {
  const facts = [];
  const adapterResolutions = new Map();
  for (const file of files) {
    if (!/\.(?:[cm]?[jt]sx?|html)$/i.test(file.path)) continue;
    const content = maskComments(file.content);
    const typeSources = source === "source" ? relevantTypeSources(file, files) : [];
    const sdkAliases = aliases(content, Object.keys(SDK_OPERATIONS));
    const sdkSymbols = [...new Set([...Object.keys(SDK_OPERATIONS), ...sdkAliases.keys()])];
    for (const match of content.matchAll(new RegExp(`(?<![A-Za-z0-9_$])(${sdkSymbols.map(escapeRegex).join("|")})\\s*\\(`, "g"))) {
      const symbol = sdkAliases.get(match[1]) ?? match[1];
      const [resolvedOperation, method, endpoint] = SDK_OPERATIONS[symbol];
      const open = (match.index ?? 0) + match[0].lastIndexOf("(");
      const end = callEnd(content, open);
      const call = content.slice(match.index, end);
      const prefix = content.slice(0, match.index ?? 0);
      const shapeSource = content.slice(0, match.index ?? 0);
      const shape = requestShape(call, shapeSource, "sdk", resolvedOperation, typeSources);
      const listQuery = resolvedOperation === "list" ? resolveListQueryFields(callArguments(call)[0] ?? "", shapeSource, typeSources) : { fields: [], resolved: true, issues: [] };
      const destructuresValue = /(?:const|let|var)\s*\{\s*value\s*\}\s*=\s*(?:await\s*)?$/.test(content.slice(Math.max(0, (match.index ?? 0) - 160), match.index ?? 0));
      const fact = validate({ file: file.path, source, mechanism: "sdk", operation: resolvedOperation, method, endpoint, recordIdProvenance: endpoint === "record" ? recordIdProvenance(callArguments(call)[0] ?? "", prefix) : "none", requestFields: shape.fields, requestRequiredFields: shape.requiredFields, requestFieldOffsets: requestFieldOffsets(call, shape.fields, match.index ?? 0), requestShapeResolved: shape.resolved, requestShapeProvenance: shape.provenance, queryFields: listQuery.fields, responseFields: destructuresValue || legacyValueResponse(content, match.index ?? 0, end) ? ["value"] : [], line: lineAt(file.content, match.index ?? 0), offset: match.index ?? 0 });
      fact.issues.push(...shape.issues, ...listQuery.issues);
      if ((!shape.resolved || !listQuery.resolved) && shape.issues.length === 0 && listQuery.issues.length === 0) fact.issues.push("request shape resolution unavailable");
      facts.push(fact);
    }
    for (const candidate of gatewayCallCandidates(content)) {
      const { start, end, call, route, routeValue } = candidate;
      const terminalSymbol = candidate.symbol.split(".").at(-1);
      const adapterKey = `${file.path}\u0000${candidate.symbol}`;
      if (!adapterResolutions.has(adapterKey)) {
        adapterResolutions.set(adapterKey, resolveAdapterSymbol(files, file.path, candidate.symbol));
      }
      const gatewayUnresolved = !adapterResolutions.get(adapterKey) &&
        !["authenticatedFetch", "requestJson", "fetch"].includes(terminalSymbol);
      const after = routeValue.slice(routeValue.indexOf("/app-data") + 9);
      const originalAfter = route.includes("/app-data") ? route.slice(route.indexOf("/app-data") + 9) : after;
      const endpoint = /^\s*(?:["'`]|\?|$)/.test(after) ? "collection" : /\/|\$\{/.test(after) ? "record" : "unknown";
      const literalMethod = /\bmethod\s*:\s*["'`](GET|POST|PATCH|DELETE|PUT)["'`]/i.exec(call)?.[1]?.toUpperCase();
      const method = literalMethod ?? ((/\bmethod\s*:/.test(call) || /(?:\{|,)\s*method\s*(?:,|\})/.test(call)) ? "UNKNOWN" : "GET");
      const resolvedOperation = operation(endpoint, method);
      const callPrefix = content.slice(0, start);
      const shapeSource = content.slice(0, start);
      const shape = requestShape(call, shapeSource, "gateway", resolvedOperation, typeSources);
      const fact = validate({ file: file.path, source, mechanism: "gateway", operation: resolvedOperation, method, endpoint, recordIdProvenance: endpoint === "record" ? recordIdProvenance(originalAfter, callPrefix) : "none", requestFields: shape.fields, requestRequiredFields: shape.requiredFields, requestFieldOffsets: requestFieldOffsets(call, shape.fields, start), requestShapeResolved: shape.resolved, requestShapeProvenance: shape.provenance, queryFields: queryFields(route, shapeSource), responseFields: legacyValueResponse(content, start, end) ? ["value"] : [], line: lineAt(file.content, start), offset: start });
      fact.issues.push(...shape.issues, ...queryValueIssues(route, shapeSource));
      if (!shape.resolved && shape.issues.length === 0) fact.issues.push("request shape resolution unavailable");
      if (gatewayUnresolved) fact.issues.push("gateway adapter is unresolved");
      facts.push(fact);
    }
  }
  return facts;
}

const signature = (fact) => [fact.endpoint, fact.method, fact.operation].join(":");
const fieldsCompatible = (source, artifact) => {
  if (source.requestFields.length === 0 || artifact.requestFields.length === 0) return true;
  if (artifact.issues.length > 0 && artifact.issues.every((issue) => issue === "dynamic request contract")) {
    return artifact.requestFields.every((field) => source.requestFields.includes(field));
  }
  if (["resolved_local_type", "trusted_public_type"].includes(source.requestShapeProvenance)) {
    return artifact.requestFields.every((field) => source.requestFields.includes(field)) &&
      (source.requestRequiredFields ?? []).every((field) => artifact.requestFields.includes(field));
  }
  return source.requestFields.length === artifact.requestFields.length && source.requestFields.every((field) => artifact.requestFields.includes(field));
};
const fieldListsCompatible = (source, artifact) => source.length === 0 || artifact.length === 0 ||
  (source.length === artifact.length && source.every((field) => artifact.includes(field)));
const artifactMatches = (source, artifact) => signature(source) === signature(artifact) &&
  fieldsCompatible(source, artifact) &&
  fieldListsCompatible(source.queryFields, artifact.queryFields);

function diagnosticMayResolveToFile(diagnostic, file) {
  const specifier = diagnostic.slice(diagnostic.lastIndexOf(":") + 1).trim().replace(/^['"]|['"]$/g, "");
  const normalizedSpecifier = specifier.replace(/^[~@]\//, "").replace(/^\.\//, "").replace(/\\/g, "/").replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  const normalizedFile = file.replace(/\\/g, "/").replace(/\.(?:[cm]?[jt]sx?)$/i, "");
  return normalizedSpecifier.length > 0 && (normalizedFile.endsWith(`/${normalizedSpecifier}`) || normalizedFile === normalizedSpecifier);
}

const APP_DATA_ARTIFACT_ANCHOR = /\/app-data(?=$|[/?#"'\`\\])|\b(?:listAppData|getAppDataRecord|createAppDataRecord|updateAppDataRecord|deleteAppDataRecord)\s*\(|(?:\.|\[\s*["'])authenticatedFetch(?:\b|["']\s*\])/;

export function selectAppDataArtifactFiles(files) {
  return files.filter((file) =>
    /\.(?:[cm]?[jt]sx?|html)$/i.test(file.path) &&
    APP_DATA_ARTIFACT_ANCHOR.test(maskComments(file.content))
  );
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
  const artifact = analyzeAppDataOperations(selectAppDataArtifactFiles(distFiles), "dist");
  const available = new Map();
  for (const fact of artifact) {
    if (fact.issues.includes("gateway adapter is unresolved")) {
      issues.push({ code: "app-data-analysis-indeterminate", file: fact.file, message: "Committed app-data gateway provenance could not be resolved." });
      continue;
    }
    const provenIssues = fact.issues.filter((issue) => !/dynamic request contract|provenance is unresolved/.test(issue));
    if (provenIssues.length === 0) available.set(signature(fact), [...(available.get(signature(fact)) ?? []), fact]);
    else issues.push({ code: "app-data-request-contract-invalid", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data operation: ${provenIssues.join(", ")}.` });
  }
  const reconciledSource = source.map((fact) => {
    if (fact.issues.length !== 1 || fact.issues[0] !== "record id provenance is unresolved") return fact;
    const matches = (available.get(signature(fact)) ?? []).filter((candidate) =>
      candidate.recordIdProvenance === "server" && artifactMatches(fact, candidate)
    );
    if (matches.length !== 1) return fact;
    const candidates = available.get(signature(fact)) ?? [];
    candidates.splice(candidates.indexOf(matches[0]), 1);
    return { ...fact, recordIdProvenance: "server", issues: [], artifactMatched: true };
  });
  for (const fact of reconciledSource) {
    if (fact.issues.includes("gateway adapter is unresolved")) {
      issues.push({ code: "app-data-analysis-indeterminate", file: fact.file, message: "App-data gateway provenance could not be resolved." });
      continue;
    }
    if (fact.issues.includes("request shape resolution unavailable")) {
      issues.push({ code: "app-data-analysis-indeterminate", file: fact.file, message: "An action-bearing app-data request shape could not be resolved statically. Make its route, method, envelope, type, spread, and record-ID source explicit." });
      continue;
    }
    const unresolvedProvenance = fact.issues.includes("record id provenance is unresolved");
    const provenIssues = fact.issues.filter((issue) => issue !== "record id provenance is unresolved");
    if (provenIssues.length > 0) issues.push({ code: "app-data-request-contract-invalid", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data operation: ${provenIssues.join(", ")}.` });
    else if (unresolvedProvenance) issues.push({ code: "app-data-analysis-indeterminate", file: fact.file, message: `${fact.method} ${fact.endpoint} app-data record ID provenance could not be resolved. Use an explicit recordId or appRecordId parameter.` });
  }
  for (const fact of reconciledSource.filter((entry) => entry.issues.length === 0 && !entry.artifactMatched)) {
    const matches = available.get(signature(fact)) ?? [];
    const matchIndex = matches.findIndex((candidate) => artifactMatches(fact, candidate));
    if (matchIndex >= 0) matches.splice(matchIndex, 1);
    else issues.push({ code: "app-data-build-artifact-missing", file: fact.file, message: `Valid ${fact.operation} app-data operation is missing from committed build output.` });
  }
  const permissions = new Set(Array.isArray(manifest?.permissions) ? manifest.permissions : []);
  if (source.some((fact) => fact.operation === "list" || fact.operation === "get") && !permissions.has("app_data.read")) issues.push({ code: "app-data-read-scope-missing", file: "plannerxchange.app.json", message: "App-data reads require app_data.read." });
  if (source.some((fact) => ["create", "update", "delete"].includes(fact.operation) || ["POST", "PATCH", "DELETE", "PUT"].includes(fact.method)) && !permissions.has("app_data.write")) issues.push({ code: "app-data-write-scope-missing", file: "plannerxchange.app.json", message: "App-data writes require app_data.write." });
  return issues;
}
import { resolveAppDataRequestShape } from "./app-data-request-shape.mjs";
