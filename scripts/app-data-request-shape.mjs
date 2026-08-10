const CREATE_FIELDS = new Set(["recordType", "title", "status", "schemaVersion", "clientUserId", "householdId", "accountId", "sourceRefs", "payload"]);
const UPDATE_FIELDS = new Set(["title", "status", "payload"]);
const LIST_FIELDS = new Set(["limit", "cursor", "recordType", "clientUserId", "householdId", "accountId", "status"]);
const SOURCE_REF_FIELDS = new Set(["sourceType", "sourceId", "sourceSystem", "asOf"]);
const TRUSTED_MODULES = new Set(["@plannerxchange/types", "@plannerxchange/sdk"]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitTopLevel(value, separator, balanceAngles = true) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote;
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (`"'\``.includes(current)) quote = current;
    else if ("([{".includes(current) || (balanceAngles && current === "<")) depth += 1;
    else if (")]}".includes(current) || (balanceAngles && current === ">")) depth = Math.max(0, depth - 1);
    else if (current === separator && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function matchingClose(value, open, opener = "{", closer = "}") {
  let depth = 0;
  let quote;
  for (let index = open; index < value.length; index += 1) {
    const current = value[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (`"'\``.includes(current)) quote = current;
    else if (current === opener) depth += 1;
    else if (current === closer && --depth === 0) return index;
  }
  return -1;
}

function lastAssignedExpression(source, identifier) {
  const declarations = [...source.matchAll(new RegExp(`\\b(?:const|let|var)\\s+${escapeRegex(identifier)}(?:\\s*:\\s*[^=;\\n]+)?\\s*=\\s*(?!=|>)`, "g"))];
  const assignments = [...source.matchAll(new RegExp(`(?<![A-Za-z0-9_$.])${escapeRegex(identifier)}\\s*=\\s*(?!=|>)`, "g"))];
  const match = [...declarations, ...assignments].sort((left, right) => (left.index ?? 0) - (right.index ?? 0)).at(-1);
  if (!match) return undefined;
  const start = (match.index ?? 0) + match[0].length;
  let depth = 0;
  let quote;
  for (let index = start; index < source.length; index += 1) {
    const current = source[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (`"'\``.includes(current)) quote = current;
    else if ("([{".includes(current)) depth += 1;
    else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && ";\n\r".includes(current)) return source.slice(start, index).trim();
  }
  return source.slice(start).trim();
}

function annotationFor(source, identifier) {
  const match = [...source.matchAll(new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(identifier)}\\s*:\\s*`, "g"))].at(-1);
  if (!match) return undefined;
  const start = (match.index ?? 0) + match[0].length;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const current = source[index];
    if ("<{[(".includes(current)) depth += 1;
    else if (depth === 0 && ",)=;\n".includes(current)) return source.slice(start, index).trim();
    else if (">}])".includes(current)) depth = Math.max(0, depth - 1);
  }
  return source.slice(start).trim();
}

function importedTypes(source) {
  const bindings = new Map();
  for (const match of source.matchAll(/\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']/g)) {
    for (const entry of splitTopLevel(match[1], ",")) {
      const parsed = /^\s*(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(entry);
      if (parsed && !bindings.has(parsed[2] ?? parsed[1])) bindings.set(parsed[2] ?? parsed[1], { imported: parsed[1], module: match[2] });
    }
  }
  return bindings;
}

const emptyShape = () => ({ fields: new Set(), required: new Set(), propertyTypes: new Map(), resolved: false, trusted: false, guaranteesNonEmpty: false });

function canonicalShape(name) {
  if (name === "AppDataCreateInput") return { fields: new Set(CREATE_FIELDS), required: new Set(["recordType", "status", "schemaVersion", "payload"]), propertyTypes: new Map([["status", "AppDataRecordStatus"], ["schemaVersion", "number"], ["payload", "Record<string, unknown>"]]), resolved: true, trusted: true, guaranteesNonEmpty: true };
  if (name === "AppDataUpdateInput") return { fields: new Set(UPDATE_FIELDS), required: new Set(), propertyTypes: new Map([["status", "AppDataRecordStatus"], ["payload", "Record<string, unknown>"]]), resolved: true, trusted: true, guaranteesNonEmpty: true };
  if (["PlannerXchangeAppDataListQuery", "AppDataListQuery"].includes(name)) return { fields: new Set(LIST_FIELDS), required: new Set(), propertyTypes: new Map([["limit", "number"], ["status", "AppDataRecordStatus"]]), resolved: true, trusted: true, guaranteesNonEmpty: false };
  return undefined;
}

function objectTypeShape(body) {
  const shape = { fields: new Set(), required: new Set(), propertyTypes: new Map(), resolved: true, trusted: false, guaranteesNonEmpty: false };
  const entries = [];
  let start = 0, depth = 0;
  for (let index = 0; index < body.length; index += 1) {
    const current = body[index];
    if ("<{[(".includes(current)) depth += 1;
    else if (">}])".includes(current)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && (current === ";" || current === "," || current === "\n" || current === "\r")) {
      if (body.slice(start, index).trim()) entries.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (body.slice(start).trim()) entries.push(body.slice(start).trim());
  for (const entry of entries) {
    const match = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*([\s\S]+)$/.exec(entry);
    if (!match) continue;
    shape.fields.add(match[1]);
    if (!match[2]) shape.required.add(match[1]);
    shape.propertyTypes.set(match[1], match[3].trim());
  }
  shape.guaranteesNonEmpty = shape.required.size > 0;
  return shape;
}

function merge(shapes, union) {
  if (shapes.length === 0 || shapes.some((shape) => !shape.resolved)) return emptyShape();
  const fields = new Set();
  const required = union ? new Set(shapes[0].required) : new Set();
  const propertyTypes = new Map();
  for (const shape of shapes) {
    for (const field of shape.fields) fields.add(field);
    if (union) {
      for (const field of [...required]) if (!shape.required.has(field)) required.delete(field);
    } else {
      for (const field of shape.required) required.add(field);
    }
    for (const [field, type] of shape.propertyTypes) propertyTypes.set(field, type);
  }
  return { fields, required, propertyTypes, resolved: true, trusted: shapes.every((shape) => shape.trusted), guaranteesNonEmpty: union ? shapes.every((shape) => shape.guaranteesNonEmpty || shape.required.size > 0) : shapes.some((shape) => shape.guaranteesNonEmpty || shape.required.size > 0) };
}

function aliasExpression(source, name) {
  const found = [...source.matchAll(new RegExp(`\\btype\\s+${escapeRegex(name)}(?:\\s*<[^;=]+>)?\\s*=\\s*`, "g"))].at(-1);
  if (!found) return undefined;
  const start = (found.index ?? 0) + found[0].length;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const current = source[index];
    if ("<{[(".includes(current)) depth += 1;
    else if (">}])".includes(current)) depth = Math.max(0, depth - 1);
    else if (current === ";" && depth === 0) return source.slice(start, index).trim();
  }
  return source.slice(start).trim();
}

function resolveType(expression, source, visited = new Set()) {
  const unions = splitTopLevel(expression.trim(), "|");
  if (unions.length > 1) return merge(unions.map((part) => resolveType(part, source, new Set(visited))), true);
  const intersections = splitTopLevel(expression.trim(), "&");
  if (intersections.length > 1) return merge(intersections.map((part) => resolveType(part, source, new Set(visited))), false);
  const partial = /^Partial\s*<([\s\S]+)>$/.exec(expression.trim());
  if (partial) { const shape = resolveType(partial[1], source, visited); return shape.resolved ? { ...shape, required: new Set(), trusted: false, guaranteesNonEmpty: false } : shape; }
  const pick = /^Pick\s*<([\s\S]+),\s*([\s\S]+)>$/.exec(expression.trim());
  if (pick) {
    const base = resolveType(pick[1], source, visited);
    if (!base.resolved) return base;
    const selected = new Set([...pick[2].matchAll(/["']([A-Za-z_$][\w$]*)["']/g)].map((match) => match[1]));
    return { fields: new Set([...base.fields].filter((field) => selected.has(field))), required: new Set([...base.required].filter((field) => selected.has(field))), propertyTypes: new Map([...base.propertyTypes].filter(([field]) => selected.has(field))), resolved: true, trusted: false, guaranteesNonEmpty: [...base.required].some((field) => selected.has(field)) };
  }
  if (expression.trim().startsWith("{")) { const close = matchingClose(expression.trim(), 0); return close >= 0 ? objectTypeShape(expression.trim().slice(1, close)) : emptyShape(); }
  const reference = /^([A-Za-z_$][\w$]*)(?:\s*<[\s\S]*>)?$/.exec(expression.trim())?.[1];
  if (!reference || visited.has(reference)) return emptyShape();
  const imported = importedTypes(source).get(reference);
  if (imported && TRUSTED_MODULES.has(imported.module)) return canonicalShape(imported.imported) ?? emptyShape();
  const declarationName = imported?.imported ?? reference;
  const next = new Set(visited).add(reference).add(declarationName);
  const interfaces = [...source.matchAll(new RegExp(`\\binterface\\s+${escapeRegex(declarationName)}(?:\\s*<[^>{]+>)?(?:\\s+extends\\s+([^\\{]+))?\\s*\\{`, "g"))];
  if (interfaces.length > 1) return emptyShape();
  const found = interfaces.at(-1);
  if (found) {
    const open = (found.index ?? 0) + found[0].lastIndexOf("{");
    const close = matchingClose(source, open);
    if (close < 0) return emptyShape();
    const bases = found[1] ? splitTopLevel(found[1], ",").map((base) => resolveType(base, source, next)) : [];
    return merge([...bases, objectTypeShape(source.slice(open + 1, close))], false);
  }
  const aliases = [...source.matchAll(new RegExp(`\\btype\\s+${escapeRegex(declarationName)}(?:\\s*<[^;=]+>)?\\s*=\\s*`, "g"))];
  if (aliases.length > 1) return emptyShape();
  const alias = aliasExpression(source, declarationName);
  return alias ? resolveType(alias, source, next) : emptyShape();
}

function validateType(shape, kind) {
  const issues = [];
  const allowed = kind === "create" ? CREATE_FIELDS : kind === "update" ? UPDATE_FIELDS : LIST_FIELDS;
  for (const field of shape.fields) if (!allowed.has(field)) issues.push(`unsupported ${kind} field ${field}`);
  if (kind === "create") for (const field of ["recordType", "status", "schemaVersion", "payload"]) if (shape.fields.has(field) && !shape.required.has(field)) issues.push(`required create field ${field} is optional`);
  if (kind === "update" && !shape.guaranteesNonEmpty) issues.push("update type allows an empty patch");
  const status = shape.propertyTypes.get("status");
  if (status && !/\bAppDataRecordStatus\b/.test(status)) {
    const literals = [...status.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    if (literals.length === 0 || literals.some((value) => !["draft", "final", "archived"].includes(value))) issues.push("invalid status type");
  }
  const schema = shape.propertyTypes.get("schemaVersion");
  if (schema && schema.replace(/\s+/g, "") !== "number") issues.push("invalid schemaVersion type");
  const payload = shape.propertyTypes.get("payload");
  if (payload && (!/(?:Record\s*<|\bobject\b|^\s*\{)/.test(payload) || /(?:^|\|)\s*(?:string|number|boolean|unknown|null|undefined)(?:\s*\||$)/.test(payload) || /\[\]\s*(?:\||$)/.test(payload))) issues.push("payload type must be an object");
  return [...new Set(issues)];
}

function literalValue(value, source) {
  const symbol = /^([A-Za-z_$][\w$]*)$/.exec(value.trim())?.[1];
  return symbol ? lastAssignedExpression(source, symbol) ?? value.trim() : value.trim();
}

function validateValue(field, rawValue, source, kind) {
  const value = literalValue(rawValue, source);
  const issues = [];
  const status = /^["']([^"']+)["']$/.exec(value)?.[1];
  if (field === "status" && status && !["draft", "final", "archived"].includes(status)) issues.push("invalid status value");
  if (field === "schemaVersion" && /^-?\d+(?:\.\d+)?$/.test(value) && (!Number.isInteger(Number(value)) || Number(value) <= 0)) issues.push("schemaVersion must be a positive integer");
  if (field === "payload" && (/^(?:null|undefined|true|false|-?\d+(?:\.\d+)?|["'])/.test(value) || value.startsWith("["))) issues.push("payload must be an object");
  if (field === "limit" && kind === "list") { const limit = /^["']?(\d+(?:\.\d+)?)["']?$/.exec(value)?.[1]; if (limit && (!Number.isInteger(Number(limit)) || Number(limit) <= 0)) issues.push("limit must be a positive integer"); }
  if (field === "sourceRefs" && value.startsWith("[")) {
    const close = matchingClose(value, 0, "[", "]");
    for (const entry of close >= 0 ? splitTopLevel(value.slice(1, close), ",", false) : []) {
      const shape = resolveExpression(entry, source, source, "create", new Set());
      if (!shape.resolved || !shape.fields.includes("sourceType") || !shape.fields.includes("sourceId") || shape.fields.some((name) => !SOURCE_REF_FIELDS.has(name))) issues.push("invalid sourceRefs entry");
    }
  }
  return issues;
}

function objectExpression(expression, source, typeSource, kind, visited) {
  const start = expression.indexOf("{");
  const close = start >= 0 ? matchingClose(expression, start) : -1;
  if (start < 0 || close < 0) return { fields: [], requiredFields: [], resolved: false, provenance: "unresolved", issues: [] };
  const fields = new Set();
  const required = new Set();
  const issues = [];
  let resolved = true;
  let spread = false;
  for (const entry of splitTopLevel(expression.slice(start + 1, close), ",", false)) {
    if (entry.startsWith("...")) {
      spread = true;
      const shape = resolveExpression(entry.slice(3).trim(), source, typeSource, kind, new Set(visited));
      if (!shape.resolved) resolved = false;
      shape.fields.forEach((field) => fields.add(field));
      shape.requiredFields.forEach((field) => required.add(field));
      issues.push(...shape.issues);
      continue;
    }
    const property = /^\s*(?:["']([^"']+)["']|([A-Za-z_$][\w$]*))\s*(?::\s*([\s\S]+))?$/.exec(entry);
    if (!property) { resolved = false; continue; }
    const field = property[1] ?? property[2];
    fields.add(field); required.add(field);
    issues.push(...validateValue(field, property[3] ?? field, source, kind));
  }
  return { fields: [...fields].sort(), requiredFields: [...required].sort(), resolved, provenance: spread ? "resolved_spread" : "literal_object", issues: [...new Set(issues)] };
}

function splitTopLevelConditional(expression) {
  let depth = 0;
  let quote;
  let question = -1;
  for (let index = 0; index < expression.length; index += 1) {
    const current = expression[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if ("([{".includes(current)) depth += 1;
    else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && current === "?" && expression[index + 1] !== "?" && expression[index + 1] !== ".") {
      question = index;
      break;
    }
  }
  if (question < 0) return undefined;
  depth = 0;
  quote = undefined;
  let nested = 0;
  for (let index = question + 1; index < expression.length; index += 1) {
    const current = expression[index];
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") quote = current;
    else if ("([{".includes(current)) depth += 1;
    else if (")]}".includes(current)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && current === "?" && expression[index + 1] !== "?" && expression[index + 1] !== ".") nested += 1;
    else if (depth === 0 && current === ":") {
      if (nested > 0) nested -= 1;
      else return [expression.slice(question + 1, index).trim(), expression.slice(index + 1).trim()];
    }
  }
  return undefined;
}

function mergeBranches(left, right) {
  const fields = [...new Set([...left.fields, ...right.fields])].sort();
  const requiredFields = left.requiredFields.filter((field) => right.requiredFields.includes(field)).sort();
  return {
    fields,
    requiredFields,
    resolved: left.resolved && right.resolved,
    provenance: left.provenance === right.provenance ? left.provenance : "resolved_spread",
    issues: [...new Set([...left.issues, ...right.issues])]
  };
}

function resolveExpression(expression, source, typeSource, kind, visited) {
  const clean = expression.replace(/\s+satisfies\s+[A-Za-z_$][\w$]*(?:<[^;]+>)?\s*$/, "").trim();
  const conditional = splitTopLevelConditional(clean);
  if (conditional) return mergeBranches(
    resolveExpression(conditional[0], source, typeSource, kind, new Set(visited)),
    resolveExpression(conditional[1], source, typeSource, kind, new Set(visited))
  );
  if (clean.startsWith("{")) return objectExpression(clean, source, typeSource, kind, visited);
  const symbol = /^([A-Za-z_$][\w$]*)$/.exec(clean)?.[1];
  if (!symbol) return { fields: [], requiredFields: [], resolved: false, provenance: "unresolved", issues: clean ? ["dynamic request contract"] : ["request shape resolution unavailable"] };
  if (visited.has(symbol)) return { fields: [], requiredFields: [], resolved: false, provenance: "unresolved", issues: ["request shape resolution unavailable"] };
  const next = new Set(visited).add(symbol);
  const assigned = lastAssignedExpression(source, symbol);
  if (assigned) { const result = resolveExpression(assigned, source, typeSource, kind, next); return { ...result, provenance: result.provenance === "literal_object" ? "resolved_assignment" : result.provenance }; }
  const annotation = annotationFor(source, symbol);
  if (!annotation) return { fields: [], requiredFields: [], resolved: false, provenance: "unresolved", issues: ["dynamic request contract"] };
  const shape = resolveType(annotation, typeSource);
  if (!shape.resolved) return { fields: [], requiredFields: [], resolved: false, provenance: "unresolved", issues: ["request shape resolution unavailable"] };
  return { fields: [...shape.fields].sort(), requiredFields: [...shape.required].sort(), resolved: true, provenance: shape.trusted ? "trusted_public_type" : "resolved_local_type", issues: validateType(shape, kind) };
}

export function resolveAppDataRequestShape({ expression, source, typeSources = [], kind }) {
  if (!expression.trim() && kind === "list") return { fields: [], requiredFields: [], resolved: true, provenance: "literal_object", issues: [] };
  const result = resolveExpression(expression.trim(), source, [source, ...typeSources].join("\n"), kind, new Set());
  if (kind !== "create") return result;
  const issues = new Set(result.issues);
  for (const field of ["recordType", "status", "schemaVersion", "payload"]) {
    if (result.fields.includes(field) && !result.requiredFields.includes(field)) issues.add(`required create field ${field} is optional`);
  }
  return { ...result, issues: [...issues] };
}
