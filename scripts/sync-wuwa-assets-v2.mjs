import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  AssetSyncHttpError,
  isSkippableOptionalMissingAsset,
  requiredUniversalAssetRoles,
} from "./lib/wuwa-asset-sync-policy.mjs";

const API_ORIGIN = "https://api-v2.encore.moe";
const API_BASE = `${API_ORIGIN}/api/en`;
const GAME_VERSION = "Release";
const OUTPUT_ROOT = path.resolve("public/assets/wuwa");
const OBJECTS_ROOT = path.join(OUTPUT_ROOT, "objects");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_REMOTE_BYTES = 1024 * 1024 * 1024;
const MAX_TOTAL_ASSETS = 10_000;
const MAX_ENTITIES_PER_CATEGORY = 1_000;
const MAX_IMAGES_PER_ENTITY = 96;
const MAX_TRAVERSAL_DEPTH = 12;
const MAX_TRAVERSAL_NODES = 20_000;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 200_000;
const MAX_JSON_ARRAY_LENGTH = 10_000;
const MAX_JSON_OBJECT_KEYS = 10_000;
const MAX_JSON_KEY_LENGTH = 256;
const MAX_JSON_STRING_LENGTH = 2 * 1024 * 1024;
const MAX_SOURCE_ID_LENGTH = 128;
const MAX_URL_LENGTH = 4_096;
const REQUEST_TIMEOUT_MS = 15_000;

const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const FORBIDDEN_REMOTE_IMAGE_PATH_PATTERN =
  /(?:^|[._-])(?:ad|ads|advert|advertisement|advertising|sponsor|sponsored|tracking|tracker|pixel|promo|promotion)(?:[._-]|$)/i;

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const SOURCES = Object.freeze({
  characters: Object.freeze({ endpoint: "/character", collectionKeys: ["roleList"], detail: true }),
  weapons: Object.freeze({ endpoint: "/weapon", collectionKeys: ["weapons"], detail: true }),
  echoes: Object.freeze({ endpoint: "/echo", collectionKeys: ["Echo", "echoes"], detail: true }),
});

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
let remoteBytesRead = 0;
const createdObjectPaths = new Set();

class SyncBudgetError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncBudgetError";
  }
}

function createDictionary() {
  return Object.create(null);
}

function assertSafeObjectKey(value, label) {
  if (DANGEROUS_OBJECT_KEYS.has(value)) {
    throw new Error(`${label} contains a forbidden object key`);
  }
  return value;
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value);
  if (normalized.length > MAX_SOURCE_ID_LENGTH) {
    throw new Error(`Source ID exceeds ${MAX_SOURCE_ID_LENGTH} characters`);
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(normalized)) {
    throw new Error("Source ID contains control characters");
  }
  return assertSafeObjectKey(normalized, "Source ID");
}

function safeSegment(value) {
  return (
    String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "asset"
  );
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseTrustedUrl(rawUrl, { api = false } = {}) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    throw new Error(`URL length must be between 1 and ${MAX_URL_LENGTH} characters`);
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Only HTTPS URLs are allowed");
  if (url.username || url.password || url.port || url.hash) {
    throw new Error("URL contains forbidden authority/hash components");
  }

  const host = url.hostname.toLowerCase();
  if (api) {
    if (url.origin !== API_ORIGIN) throw new Error(`Rejected API origin: ${url.origin}`);
  } else if (host !== "encore.moe" && !host.endsWith(".encore.moe")) {
    throw new Error(`Rejected image host: ${host}`);
  }

  return url;
}

function buildApiUrl(endpoint, sourceId) {
  const normalizedId = sourceId === undefined ? null : normalizeId(sourceId);
  const suffix = normalizedId === null ? "" : `/${encodeURIComponent(normalizedId)}`;
  const url = new URL(`${API_BASE}${endpoint}${suffix}`);
  url.searchParams.set("v", GAME_VERSION);
  return url.toString();
}

function validateRemoteJsonTree(root) {
  const stack = [{ value: root, depth: 0, label: "$" }];
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_JSON_NODES) throw new Error("Encore JSON exceeded node limit");
    if (current.depth > MAX_JSON_DEPTH) throw new Error("Encore JSON exceeded depth limit");

    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_JSON_STRING_LENGTH) {
        throw new Error(`Encore JSON string is too long at ${current.label}`);
      }
      continue;
    }
    if (value === null || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      if (value.length > MAX_JSON_ARRAY_LENGTH) {
        throw new Error(`Encore JSON array is too large at ${current.label}`);
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: value[index],
          depth: current.depth + 1,
          label: `${current.label}[${index}]`,
        });
      }
      continue;
    }

    const keys = Object.keys(value);
    if (keys.length > MAX_JSON_OBJECT_KEYS) {
      throw new Error(`Encore JSON object has too many keys at ${current.label}`);
    }
    for (const key of keys) {
      if (key.length > MAX_JSON_KEY_LENGTH) {
        throw new Error(`Encore JSON key is too long at ${current.label}`);
      }
      assertSafeObjectKey(key, `Encore JSON key at ${current.label}`);
      stack.push({
        value: value[key],
        depth: current.depth + 1,
        label: `${current.label}.${key}`,
      });
    }
  }
}

function looksLikeImageField(fieldPath, key, value) {
  if (FORBIDDEN_REMOTE_IMAGE_PATH_PATTERN.test(fieldPath)) return false;
  if (typeof value !== "string") return false;

  let url;
  try {
    url = parseTrustedUrl(value);
  } catch {
    return false;
  }

  const lowerKey = key.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  return (
    /(?:icon|image|picture|portrait|head|avatar|sprite|art|logo|texture|bg|background)/i.test(
      lowerKey,
    ) || /\.(?:png|jpe?g|webp)$/i.test(pathname)
  );
}

function collectImageUrls(value, prefix = "root") {
  const found = new Map();
  const stack = [{ value, prefix, depth: 0 }];
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.value === null || typeof current.value !== "object") continue;
    if (current.depth > MAX_TRAVERSAL_DEPTH) {
      throw new Error("Encore payload exceeded traversal depth limit");
    }
    visited += 1;
    if (visited > MAX_TRAVERSAL_NODES) {
      throw new Error("Encore payload exceeded traversal node limit");
    }

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          prefix: `${current.prefix}.${index}`,
          depth: current.depth + 1,
        });
      }
      continue;
    }

    for (const [key, child] of Object.entries(current.value)) {
      const fieldPath = `${current.prefix}.${key}`;
      if (looksLikeImageField(fieldPath, key, child)) {
        if (found.size >= MAX_IMAGES_PER_ENTITY) {
          throw new Error(`Entity exceeded ${MAX_IMAGES_PER_ENTITY} image fields`);
        }
        found.set(fieldPath, parseTrustedUrl(child).toString());
      } else if (child && typeof child === "object") {
        stack.push({
          value: child,
          prefix: fieldPath,
          depth: current.depth + 1,
        });
      }
    }
  }

  return found;
}

function mergeImageUrls(target, extra) {
  for (const [key, value] of extra) {
    if (target.has(key)) continue;
    if (target.size >= MAX_IMAGES_PER_ENTITY) {
      throw new Error(`Entity exceeded ${MAX_IMAGES_PER_ENTITY} image fields`);
    }
    target.set(key, value);
  }
  return target;
}

function getCollection(payload, collectionKeys) {
  for (const key of collectionKeys) {
    if (!Array.isArray(payload?.[key])) continue;
    if (payload[key].length > MAX_ENTITIES_PER_CATEGORY) {
      throw new Error(`Collection ${key} exceeds ${MAX_ENTITIES_PER_CATEGORY} entities`);
    }
    return payload[key];
  }
  throw new Error(
    `Unexpected Encore response; none of [${collectionKeys.join(", ")}] identifies the entity collection.`,
  );
}

function getEntityId(entity) {
  return normalizeId(entity?.Id ?? entity?.id ?? entity?.ID ?? entity?.RoleId ?? entity?.ItemId);
}

function getEntityName(entity) {
  const candidate =
    entity?.Name?.Content ??
    entity?.Name ??
    entity?.WeaponName ??
    entity?.MonsterName ??
    entity?.name ??
    entity?.Title ??
    entity?.title ??
    "Unknown";
  return String(candidate)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .slice(0, 200);
}

function consumeRemoteBudget(bytes) {
  remoteBytesRead += bytes;
  if (remoteBytesRead > MAX_TOTAL_REMOTE_BYTES) {
    throw new SyncBudgetError(`Remote transfer budget exceeded ${MAX_TOTAL_REMOTE_BYTES} bytes`);
  }
}

async function readResponseWithLimit(response, maxBytes) {
  if (!response.body) throw new Error("Response body is missing");

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Response exceeds ${maxBytes} bytes`);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      consumeRemoteBudget(value.byteLength);
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("size limit exceeded");
        throw new Error(`Response exceeds ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) throw new Error("Response body is empty");
  return Buffer.concat(chunks, total);
}

async function trustedFetch(rawUrl, { accept, api = false, maxBytes }) {
  const url = parseTrustedUrl(rawUrl, { api });
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: accept,
      "User-Agent": "wuwa-dps-calculator-asset-sync/4",
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AssetSyncHttpError(response.status, `Request returned HTTP ${response.status}`);
  }
  const buffer = await readResponseWithLimit(response, maxBytes);
  return { response, buffer };
}

async function fetchJson(rawUrl) {
  const { response, buffer } = await trustedFetch(rawUrl, {
    accept: "application/json",
    api: true,
    maxBytes: MAX_JSON_BYTES,
  });
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new Error(`Expected application/json, got ${contentType || "no content-type"}`);
  }

  let json;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new Error("Encore returned invalid UTF-8 JSON");
  }
  validateRemoteJsonTree(json);
  return json;
}

function detectImage(buffer, contentType) {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES.get(ct);
  if (!extension) throw new Error(`Rejected image content-type: ${ct || "none"}`);

  const isPng =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg =
    buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  const signatureMatches =
    (ct === "image/png" && isPng) ||
    (ct === "image/jpeg" && isJpeg) ||
    (ct === "image/webp" && isWebp);
  if (!signatureMatches) throw new Error(`Image signature does not match ${ct}`);
  return { extension, contentType: ct };
}

async function downloadImage(rawUrl) {
  const { response, buffer } = await trustedFetch(rawUrl, {
    accept: "image/webp,image/png,image/jpeg",
    maxBytes: MAX_IMAGE_BYTES,
  });
  return { buffer, ...detectImage(buffer, response.headers.get("content-type")) };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadExistingManifest() {
  try {
    const raw = await readFile(MANIFEST_PATH);
    if (raw.length > MAX_JSON_BYTES) throw new Error("Existing manifest exceeds size limit");
    const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    validateRemoteJsonTree(manifest);
    return manifest;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function manifestAssetKey(fieldPath) {
  return assertSafeObjectKey(safeSegment(fieldPath.replaceAll(".", "-")), "Asset key");
}

function resolveObjectPath(hash, extension) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid SHA-256 object key");
  if (![...ALLOWED_IMAGE_TYPES.values()].includes(extension)) {
    throw new Error("Invalid object extension");
  }
  const outputPath = path.resolve(OBJECTS_ROOT, `${hash}.${extension}`);
  const relative = path.relative(OBJECTS_ROOT, outputPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved object path escaped the object store");
  }
  return outputPath;
}

function resolveManifestPath(assetPath) {
  if (
    typeof assetPath !== "string" ||
    !/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(assetPath)
  ) {
    return null;
  }
  const absolute = path.resolve("public", assetPath.slice(1));
  const relative = path.relative(OUTPUT_ROOT, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolute;
}

function isValidManifestAssetRecord(asset) {
  if (
    !asset ||
    typeof asset.sourceUrl !== "string" ||
    typeof asset.path !== "string" ||
    typeof asset.sha256 !== "string" ||
    typeof asset.contentType !== "string" ||
    !Number.isInteger(asset.bytes) ||
    asset.bytes <= 0 ||
    asset.bytes > MAX_IMAGE_BYTES ||
    !/^[a-f0-9]{64}$/.test(asset.sha256)
  ) {
    return false;
  }

  try {
    parseTrustedUrl(asset.sourceUrl);
  } catch {
    return false;
  }
  const extension = ALLOWED_IMAGE_TYPES.get(asset.contentType);
  if (!extension) return false;
  return asset.path === `/assets/wuwa/objects/${asset.sha256}.${extension}`;
}

function toPublicPath(outputPath) {
  const publicRoot = path.resolve("public");
  const relative = path.relative(publicRoot, outputPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Asset path escaped public root");
  }
  return `/${relative.split(path.sep).join("/")}`;
}

async function writeFileAtomic(filePath, buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, buffer, { flag: "wx", mode: 0o644 });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function verifyObjectFile(filePath, expectedHash) {
  const raw = await readFile(filePath);
  if (raw.length === 0 || raw.length > MAX_IMAGE_BYTES) {
    throw new Error(`Existing object has invalid size: ${filePath}`);
  }
  if (sha256(raw) !== expectedHash) {
    throw new Error(`Existing object hash mismatch: ${filePath}`);
  }
}

function buildPreviousUrlIndex(previousManifest) {
  const index = new Map();
  for (const category of Object.values(previousManifest?.entities ?? {})) {
    if (!category || typeof category !== "object" || Array.isArray(category)) continue;
    for (const entity of Object.values(category)) {
      for (const asset of Object.values(entity?.assets ?? {})) {
        if (isValidManifestAssetRecord(asset)) index.set(asset.sourceUrl, asset);
      }
    }
  }
  return index;
}

function buildPreviousReferencedPaths(previousManifest) {
  const paths = new Set();
  for (const category of Object.values(previousManifest?.entities ?? {})) {
    if (!category || typeof category !== "object" || Array.isArray(category)) continue;
    for (const entity of Object.values(category)) {
      for (const asset of Object.values(entity?.assets ?? {})) {
        if (isValidManifestAssetRecord(asset)) paths.add(asset.path);
      }
    }
  }
  return paths;
}

async function getEntries(category, source) {
  const payload = await fetchJson(buildApiUrl(source.endpoint));
  const collection = getCollection(payload, source.collectionKeys);
  const entries = [];
  const seenIds = new Set();

  for (const entity of collection) {
    const id = getEntityId(entity);
    if (!id) throw new Error(`${category} list contains an entity without a stable source ID`);
    if (seenIds.has(id)) throw new Error(`${category} list contains duplicate source ID ${id}`);
    seenIds.add(id);

    const images = collectImageUrls(entity, "list");
    if (source.detail) {
      try {
        const detail = await fetchJson(buildApiUrl(source.endpoint, id));
        mergeImageUrls(images, collectImageUrls(detail, "detail"));
      } catch (error) {
        if (error instanceof AssetSyncHttpError && error.status === 404) {
          console.warn(`[detail-missing] ${category}:${id} HTTP 404`);
        } else {
          throw error;
        }
      }
    }

    for (const requiredAssetKey of requiredUniversalAssetRoles[category] ?? []) {
      const hasRequired = [...images.keys()].some(
        (fieldPath) => manifestAssetKey(fieldPath) === requiredAssetKey,
      );
      if (!hasRequired) {
        throw new Error(`${category}:${id} is missing required universal role ${requiredAssetKey}`);
      }
    }

    entries.push({ id, name: getEntityName(entity), images });
  }

  return entries;
}

async function resolveReusableAsset(sourceUrl, previousUrlIndex) {
  if (force) return null;
  const previous = previousUrlIndex.get(sourceUrl);
  if (!previous || !isValidManifestAssetRecord(previous)) return null;
  const filePath = resolveManifestPath(previous.path);
  if (!filePath || !(await fileExists(filePath))) return null;
  await verifyObjectFile(filePath, previous.sha256);
  return previous;
}

async function materializeDownloadedAsset(sourceUrl, downloaded) {
  const hash = sha256(downloaded.buffer);
  const objectPath = resolveObjectPath(hash, downloaded.extension);
  if (await fileExists(objectPath)) {
    await verifyObjectFile(objectPath, hash);
  } else {
    await writeFileAtomic(objectPath, downloaded.buffer);
    createdObjectPaths.add(objectPath);
  }
  return Object.freeze({
    path: toPublicPath(objectPath),
    sourceUrl,
    contentType: downloaded.contentType,
    bytes: downloaded.buffer.length,
    sha256: hash,
  });
}

function assertRequiredManifestCoverage(entities) {
  for (const [category, requiredKeys] of Object.entries(requiredUniversalAssetRoles)) {
    for (const [sourceId, entity] of Object.entries(entities[category] ?? {})) {
      for (const requiredKey of requiredKeys) {
        if (!entity.assets?.[requiredKey]) {
          throw new Error(`${category}:${sourceId} did not materialize required role ${requiredKey}`);
        }
      }
    }
  }
}

function buildReferencedObjectPaths(entities) {
  const paths = new Set();
  for (const category of Object.values(entities)) {
    for (const entity of Object.values(category)) {
      for (const asset of Object.values(entity.assets ?? {})) paths.add(asset.path);
    }
  }
  return paths;
}

async function pruneUnreferencedObjects(referencedPaths) {
  const entries = await readdir(OBJECTS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(entry.name)) {
      throw new Error(`Unexpected object-store entry: ${entry.name}`);
    }
    const publicPath = `/assets/wuwa/objects/${entry.name}`;
    if (!referencedPaths.has(publicPath)) await unlink(path.join(OBJECTS_ROOT, entry.name));
  }
}

async function cleanupCreatedObjectsAfterFailure(previousReferencedPaths) {
  for (const objectPath of createdObjectPaths) {
    const publicPath = toPublicPath(objectPath);
    if (previousReferencedPaths.has(publicPath)) continue;
    await unlink(objectPath).catch(() => {});
  }
}

async function writeManifestAtomic(manifest) {
  const serialized = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (serialized.length > MAX_JSON_BYTES) throw new Error("Generated manifest exceeds size limit");
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeFileAtomic(MANIFEST_PATH, serialized);
}

async function main() {
  await mkdir(OBJECTS_ROOT, { recursive: true });
  const previousManifest = await loadExistingManifest();
  const previousUrlIndex = buildPreviousUrlIndex(previousManifest);
  const previousReferencedPaths = buildPreviousReferencedPaths(previousManifest);
  const currentUrlIndex = new Map();
  const entities = {
    characters: createDictionary(),
    weapons: createDictionary(),
    echoes: createDictionary(),
  };

  let logicalAssetCount = 0;
  let downloadedAssetCount = 0;
  let reusedAssetCount = 0;
  let optionalMissingHttp404 = 0;

  try {
    for (const [category, source] of Object.entries(SOURCES)) {
      const entries = await getEntries(category, source);
      for (const entry of entries) {
        const assets = createDictionary();
        for (const [fieldPath, sourceUrlRaw] of entry.images) {
          logicalAssetCount += 1;
          if (logicalAssetCount > MAX_TOTAL_ASSETS) {
            throw new SyncBudgetError(`Asset count exceeded ${MAX_TOTAL_ASSETS}`);
          }

          const assetKey = manifestAssetKey(fieldPath);
          if (Object.prototype.hasOwnProperty.call(assets, assetKey)) {
            throw new Error(`${category}:${entry.id} has colliding normalized asset key ${assetKey}`);
          }
          const sourceUrl = parseTrustedUrl(sourceUrlRaw).toString();

          if (dryRun) {
            console.log(`[dry-run] ${category}:${entry.id} ${assetKey}`);
            continue;
          }

          let record = currentUrlIndex.get(sourceUrl) ?? null;
          if (!record) {
            record = await resolveReusableAsset(sourceUrl, previousUrlIndex);
            if (record) reusedAssetCount += 1;
          }

          if (!record) {
            try {
              record = await materializeDownloadedAsset(sourceUrl, await downloadImage(sourceUrl));
              downloadedAssetCount += 1;
            } catch (error) {
              if (isSkippableOptionalMissingAsset(category, assetKey, error)) {
                optionalMissingHttp404 += 1;
                console.warn(`[optional-missing] ${category}:${entry.id} ${assetKey} HTTP 404`);
                continue;
              }
              throw new Error(
                `${category}:${entry.id} ${assetKey} failed: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
              );
            }
          }

          currentUrlIndex.set(sourceUrl, record);
          assets[assetKey] = record;
        }

        entities[category][entry.id] = {
          sourceId: entry.id,
          entityKey: `${category}:${entry.id}`,
          name: entry.name,
          assets,
        };
      }
    }

    if (dryRun) {
      console.log(
        `WUWA_ASSET_SYNC_REPORT=${JSON.stringify({
          dryRun: true,
          logicalAssets: logicalAssetCount,
          remoteBytesRead,
          maxImagesPerEntity: MAX_IMAGES_PER_ENTITY,
        })}`,
      );
      return;
    }

    assertRequiredManifestCoverage(entities);

    const manifest = {
      schemaVersion: 2,
      source: "Encore.moe",
      sourceApi: API_BASE,
      gameVersion: GAME_VERSION,
      generatedAt: new Date().toISOString(),
      categories: Object.keys(SOURCES),
      storage: {
        strategy: "sha256-content-addressed",
        root: "/assets/wuwa/objects",
      },
      security: {
        allowedFormats: [...ALLOWED_IMAGE_TYPES.keys()],
        maxImageBytes: MAX_IMAGE_BYTES,
        maxRemoteBytesPerRun: MAX_TOTAL_REMOTE_BYTES,
        maxAssetsPerRun: MAX_TOTAL_ASSETS,
        maxImagesPerEntity: MAX_IMAGES_PER_ENTITY,
        optionalMissingHttp404,
      },
      entities,
    };

    const referencedPaths = buildReferencedObjectPaths(entities);
    await writeManifestAtomic(manifest);
    await pruneUnreferencedObjects(referencedPaths);

    console.log(
      `WUWA_ASSET_SYNC_REPORT=${JSON.stringify({
        dryRun: false,
        logicalAssets: logicalAssetCount,
        materializedAssets: referencedPaths.size,
        downloadedAssets: downloadedAssetCount,
        reusedAssets: reusedAssetCount,
        optionalMissingHttp404,
        remoteBytesRead,
        maxImagesPerEntity: MAX_IMAGES_PER_ENTITY,
      })}`,
    );
  } catch (error) {
    await cleanupCreatedObjectsAfterFailure(previousReferencedPaths);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
