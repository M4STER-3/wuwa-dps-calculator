import { createHash } from "node:crypto";

export const ENCORE_API_ORIGIN = "https://api-v2.encore.moe";
export const ENCORE_API_BASE = `${ENCORE_API_ORIGIN}/api/en`;
export const ENCORE_DATASET = "Release";

export const ENCORE_RESOURCES = Object.freeze({
  characters: Object.freeze({ endpoint: "character", collectionKeys: ["roleList"] }),
  weapons: Object.freeze({ endpoint: "weapon", collectionKeys: ["weapons"] }),
  echoes: Object.freeze({ endpoint: "echo", collectionKeys: ["Echo", "echoes"] }),
});

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_REMOTE_BYTES = 256 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 200_000;
const MAX_ARRAY_LENGTH = 10_000;
const MAX_OBJECT_KEYS = 10_000;
const MAX_KEY_LENGTH = 256;
const MAX_STRING_LENGTH = 2 * 1024 * 1024;
const MAX_SOURCE_ID_LENGTH = 128;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export class EncoreBudgetError extends Error {
  constructor(message) {
    super(message);
    this.name = "EncoreBudgetError";
  }
}

export function createEncoreBudget(maxBytes = MAX_TOTAL_REMOTE_BYTES) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Encore budget must be a positive integer");
  }
  return { maxBytes, bytesRead: 0 };
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function normalizeEncoreSourceId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = String(value);
  if (id.length > MAX_SOURCE_ID_LENGTH) throw new Error("Encore source id is too long");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(id)) {
    throw new Error("Encore source id contains control characters");
  }
  if (DANGEROUS_KEYS.has(id)) throw new Error("Encore source id is a forbidden object key");
  return id;
}

export function getEncoreEntityId(entity) {
  if (!entity || typeof entity !== "object") return null;
  return normalizeEncoreSourceId(
    entity.Id ?? entity.id ?? entity.ID ?? entity.RoleId ?? entity.ItemId,
  );
}

export function getEncoreCollection(payload, resourceName) {
  const config = ENCORE_RESOURCES[resourceName];
  if (!config) throw new Error(`Unknown Encore resource: ${resourceName}`);
  if (!payload || typeof payload !== "object") {
    throw new Error(`Encore ${resourceName} list is not an object`);
  }

  for (const key of config.collectionKeys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  throw new Error(
    `Encore ${resourceName} response does not contain one of: ${config.collectionKeys.join(", ")}`,
  );
}

function validateRemoteJsonTree(root) {
  const stack = [{ value: root, depth: 0, path: "$" }];
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_JSON_NODES) throw new Error("Encore JSON exceeded node limit");
    if (current.depth > MAX_JSON_DEPTH) throw new Error("Encore JSON exceeded depth limit");

    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) {
        throw new Error(`Encore JSON string is too long at ${current.path}`);
      }
      continue;
    }
    if (value === null || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) {
        throw new Error(`Encore JSON array is too large at ${current.path}`);
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, path: `${current.path}[${index}]` });
      }
      continue;
    }

    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) {
      throw new Error(`Encore JSON object has too many keys at ${current.path}`);
    }
    for (const key of keys) {
      if (key.length > MAX_KEY_LENGTH) throw new Error(`Encore JSON key is too long at ${current.path}`);
      if (DANGEROUS_KEYS.has(key)) throw new Error(`Encore JSON contains forbidden key ${key}`);
      stack.push({ value: value[key], depth: current.depth + 1, path: `${current.path}.${key}` });
    }
  }
}

function buildEncoreUrl(resourceName, sourceId) {
  const config = ENCORE_RESOURCES[resourceName];
  if (!config) throw new Error(`Unknown Encore resource: ${resourceName}`);
  const id = sourceId === undefined ? null : normalizeEncoreSourceId(sourceId);
  const suffix = id === null ? "" : `/${encodeURIComponent(id)}`;
  const url = new URL(`${ENCORE_API_BASE}/${config.endpoint}${suffix}`);
  url.searchParams.set("v", ENCORE_DATASET);
  return url;
}

function assertTrustedRequestUrl(url) {
  if (!(url instanceof URL)) throw new Error("Encore request URL must be a URL object");
  if (url.protocol !== "https:") throw new Error("Encore requests require HTTPS");
  if (url.origin !== ENCORE_API_ORIGIN) throw new Error(`Rejected Encore origin: ${url.origin}`);
  if (url.username || url.password || url.port || url.hash) {
    throw new Error("Encore request URL contains forbidden authority/hash components");
  }
  if (url.searchParams.get("v") !== ENCORE_DATASET || [...url.searchParams.keys()].length !== 1) {
    throw new Error("Encore request must target the Release dataset only");
  }

  const allowedPaths = new Set();
  for (const config of Object.values(ENCORE_RESOURCES)) {
    const root = `${new URL(ENCORE_API_BASE).pathname}/${config.endpoint}`;
    allowedPaths.add(root);
    if (url.pathname.startsWith(`${root}/`)) return;
  }
  if (!allowedPaths.has(url.pathname)) throw new Error(`Rejected Encore API path: ${url.pathname}`);
}

async function readBodyWithLimit(response, budget, maxBytes) {
  if (!response.body) throw new Error("Encore response body is missing");
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Encore response exceeds ${maxBytes} bytes`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      budget.bytesRead += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response limit exceeded");
        throw new Error(`Encore response exceeds ${maxBytes} bytes`);
      }
      if (budget.bytesRead > budget.maxBytes) {
        await reader.cancel("total import budget exceeded");
        throw new EncoreBudgetError(`Encore import exceeded ${budget.maxBytes} remote bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) throw new Error("Encore returned an empty response");
  return Buffer.concat(chunks, total);
}

export async function fetchEncoreJson(resourceName, options = {}) {
  const budget = options.budget ?? createEncoreBudget();
  const url = buildEncoreUrl(resourceName, options.sourceId);
  assertTrustedRequestUrl(url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "wuwa-dps-calculator-game-data-import/1",
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Encore request returned HTTP ${response.status}`);
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new Error(`Encore response must be application/json, got ${contentType || "none"}`);
  }

  const raw = await readBodyWithLimit(response, budget, options.maxBytes ?? MAX_RESPONSE_BYTES);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new Error("Encore response is not valid UTF-8");
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Encore response is not valid JSON");
  }
  validateRemoteJsonTree(json);

  return {
    url: url.toString(),
    raw,
    json,
    bytes: raw.length,
    sha256: sha256(raw),
    contentType,
    budget,
  };
}

export const encoreClientLimits = Object.freeze({
  maxResponseBytes: MAX_RESPONSE_BYTES,
  maxTotalRemoteBytes: MAX_TOTAL_REMOTE_BYTES,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  maxJsonDepth: MAX_JSON_DEPTH,
  maxJsonNodes: MAX_JSON_NODES,
});
