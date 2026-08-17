import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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
const MAX_ENTITIES_PER_CATEGORY = 1000;
const MAX_IMAGES_PER_ENTITY = 32;
const MAX_TRAVERSAL_DEPTH = 12;
const MAX_TRAVERSAL_NODES = 20_000;
const MAX_SOURCE_ID_LENGTH = 128;
const MAX_URL_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 15_000;

const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const SOURCES = {
  characters: { endpoint: "/character", collectionKeys: ["roleList"], detail: true },
  weapons: { endpoint: "/weapon", collectionKeys: ["weapons"], detail: true },
  echoes: { endpoint: "/echo", collectionKeys: ["Echo", "echoes"], detail: true },
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
let remoteBytesRead = 0;

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
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "asset";
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

function looksLikeImageField(key, value) {
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
    /(?:icon|image|picture|portrait|head|avatar|sprite|art|logo|texture|bg|background)/i.test(lowerKey) ||
    /\.(?:png|jpe?g|webp)$/i.test(pathname)
  );
}

function collectImageUrls(value, prefix = "root") {
  const found = new Map();
  const stack = [{ value, prefix, depth: 0 }];
  let visited = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.value === null || typeof current.value !== "object") continue;
    if (current.depth > MAX_TRAVERSAL_DEPTH) throw new Error("Encore payload exceeded traversal depth limit");
    visited++;
    if (visited > MAX_TRAVERSAL_NODES) throw new Error("Encore payload exceeded traversal node limit");

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index--) {
        stack.push({ value: current.value[index], prefix: `${current.prefix}.${index}`, depth: current.depth + 1 });
      }
      continue;
    }

    for (const [key, child] of Object.entries(current.value)) {
      const fieldPath = `${current.prefix}.${key}`;
      if (looksLikeImageField(key, child)) {
        if (found.size >= MAX_IMAGES_PER_ENTITY) throw new Error(`Entity exceeded ${MAX_IMAGES_PER_ENTITY} image fields`);
        found.set(fieldPath, parseTrustedUrl(child).toString());
      } else if (child && typeof child === "object") {
        stack.push({ value: child, prefix: fieldPath, depth: current.depth + 1 });
      }
    }
  }

  return found;
}

function mergeImageUrls(target, extra) {
  for (const [key, value] of extra) {
    if (!target.has(key)) {
      if (target.size >= MAX_IMAGES_PER_ENTITY) throw new Error(`Entity exceeded ${MAX_IMAGES_PER_ENTITY} image fields`);
      target.set(key, value);
    }
  }
  return target;
}

function getCollection(payload, collectionKeys) {
  for (const key of collectionKeys) {
    if (Array.isArray(payload?.[key])) {
      if (payload[key].length > MAX_ENTITIES_PER_CATEGORY) {
        throw new Error(`Collection ${key} exceeds ${MAX_ENTITIES_PER_CATEGORY} entities`);
      }
      return payload[key];
    }
  }
  throw new Error(`Unexpected Encore response; none of [${collectionKeys.join(", ")}] identifies the entity collection.`);
}

function getEntityId(entity) {
  return normalizeId(entity?.Id ?? entity?.id ?? entity?.ID ?? entity?.RoleId ?? entity?.ItemId);
}

function getEntityName(entity) {
  return String(entity?.Name ?? entity?.name ?? entity?.Title ?? entity?.title ?? "Unknown")
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
    headers: { Accept: accept, "User-Agent": "wuwa-dps-calculator-asset-sync/3" },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Request returned HTTP ${response.status}`);
  const buffer = await readResponseWithLimit(response, maxBytes);
  return { response, buffer };
}

async function fetchJson(rawUrl) {
  const { response, buffer } = await trustedFetch(rawUrl, {
    accept: "application/json",
    api: true,
    maxBytes: MAX_JSON_BYTES,
  });

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new Error(`Expected application/json, got ${contentType || "no content-type"}`);
  }

  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("Encore returned invalid JSON");
  }
}

function detectImage(buffer, contentType) {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES.get(ct);
  if (!extension) throw new Error(`Rejected image content-type: ${ct || "none"}`);

  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";

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
    return JSON.parse(raw.toString("utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function manifestAssetKey(fieldPath) {
  return assertSafeObjectKey(safeSegment(fieldPath.replaceAll(".", "-")), "Asset key");
}

function resolveObjectPath(hash, extension) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid SHA-256 object key");
  if (![...ALLOWED_IMAGE_TYPES.values()].includes(extension)) throw new Error("Invalid object extension");

  const outputPath = path.resolve(OBJECTS_ROOT, `${hash}.${extension}`);
  const relative = path.relative(OBJECTS_ROOT, outputPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved object path escaped the object store");
  }
  return outputPath;
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

function resolveManifestPath(assetPath) {
  if (typeof assetPath !== "string" || !/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(assetPath)) return null;
  const absolute = path.resolve("public", assetPath.slice(1));
  const relative = path.relative(OUTPUT_ROOT, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolute;
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
  if (previousManifest?.schemaVersion !== 2) return index;

  for (const category of Object.values(previousManifest.entities ?? {})) {
    for (const entity of Object.values(category ?? {})) {
      for (const asset of Object.values(entity?.assets ?? {})) {
        if (isValidManifestAssetRecord(asset)) {
          index.set(asset.sourceUrl, asset);
        }
      }
    }
  }
  return index;
}

async function reusableAsset(asset) {
  if (!isValidManifestAssetRecord(asset)) return false;
  const filePath = resolveManifestPath(asset.path);
  if (!filePath || !(await fileExists(filePath))) return false;
  await verifyObjectFile(filePath, asset.sha256);
  return true;
}

function collectReferencedObjectPaths(manifest) {
  const referenced = new Set();
  for (const category of Object.values(manifest.entities ?? {})) {
    for (const entity of Object.values(category ?? {})) {
      for (const asset of Object.values(entity?.assets ?? {})) {
        if (isValidManifestAssetRecord(asset)) {
          referenced.add(asset.path);
        }
      }
    }
  }
  return referenced;
}

async function pruneUnreferencedObjects(manifest) {
  const referenced = collectReferencedObjectPaths(manifest);
  let entries;
  try {
    entries = await readdir(OBJECTS_ROOT, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }

  let pruned = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(entry.name)) continue;
    const filePath = path.resolve(OBJECTS_ROOT, entry.name);
    const publicPath = toPublicPath(filePath);
    if (!referenced.has(publicPath)) {
      await unlink(filePath);
      pruned++;
    }
  }
  return pruned;
}

async function collectEntityImages(entity, category, config, sourceId) {
  const images = collectImageUrls(entity, "list");
  if (!config.detail) return images;

  const detailUrl = `${API_BASE}${config.endpoint}/${encodeURIComponent(sourceId)}?v=${encodeURIComponent(GAME_VERSION)}`;
  try {
    const detail = await fetchJson(detailUrl);
    mergeImageUrls(images, collectImageUrls(detail, "detail"));
  } catch (error) {
    if (error instanceof SyncBudgetError) throw error;
    console.warn(`[${category}] detail unavailable for ${sourceId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return images;
}

async function main() {
  const previousManifest = await loadExistingManifest();
  const previousUrlIndex = buildPreviousUrlIndex(previousManifest);
  const currentUrlIndex = new Map();

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
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
    },
    entities: createDictionary(),
  };

  let discovered = 0;
  let downloaded = 0;
  let reused = 0;
  let deduplicated = 0;
  let failed = 0;

  for (const [category, config] of Object.entries(SOURCES)) {
    const url = `${API_BASE}${config.endpoint}?v=${encodeURIComponent(GAME_VERSION)}`;
    console.log(`\n[${category}] syncing Release assets`);
    const payload = await fetchJson(url);
    const entities = getCollection(payload, config.collectionKeys);
    manifest.entities[category] = createDictionary();

    for (const entity of entities) {
      const sourceId = getEntityId(entity);
      if (!sourceId) {
        console.warn(`[${category}] skipped entity without stable ID`);
        continue;
      }
      if (Object.hasOwn(manifest.entities[category], sourceId)) {
        throw new Error(`[${category}] duplicate stable source ID: ${sourceId}`);
      }

      const entityKey = `${category}:${sourceId}`;
      const imageUrls = await collectEntityImages(entity, category, config, sourceId);
      const entry = { sourceId, entityKey, name: getEntityName(entity), assets: createDictionary() };

      for (const [fieldPath, imageUrl] of imageUrls) {
        discovered++;
        if (discovered > MAX_TOTAL_ASSETS) {
          throw new SyncBudgetError(`Asset discovery exceeded ${MAX_TOTAL_ASSETS} entries`);
        }

        const assetKey = manifestAssetKey(fieldPath);
        if (Object.hasOwn(entry.assets, assetKey)) {
          const prior = entry.assets[assetKey];
          if (prior?.sourceUrl === imageUrl) continue;
          throw new Error(`Asset key collision for ${entityKey}: ${assetKey}`);
        }

        if (!force) {
          const sameUrlAsset = currentUrlIndex.get(imageUrl) ?? previousUrlIndex.get(imageUrl);
          if (sameUrlAsset && (currentUrlIndex.has(imageUrl) || (await reusableAsset(sameUrlAsset)))) {
            entry.assets[assetKey] = { ...sameUrlAsset, sourceUrl: imageUrl };
            currentUrlIndex.set(imageUrl, entry.assets[assetKey]);
            reused++;
            continue;
          }
        }

        if (dryRun) {
          entry.assets[assetKey] = { sourceUrl: imageUrl, path: null, status: "would-download-or-deduplicate" };
          console.log(`[dry-run] ${entityKey} ${assetKey}`);
          continue;
        }

        try {
          const { buffer, extension, contentType } = await downloadImage(imageUrl);
          const contentHash = sha256(buffer);
          const outputPath = resolveObjectPath(contentHash, extension);
          const relativePath = toPublicPath(outputPath);

          if (await fileExists(outputPath)) {
            await verifyObjectFile(outputPath, contentHash);
            deduplicated++;
            console.log(`[deduplicated] ${entityKey} ${assetKey}`);
          } else {
            await writeFileAtomic(outputPath, buffer);
            downloaded++;
            console.log(`[saved] ${entityKey} ${assetKey}`);
          }

          const record = {
            path: relativePath,
            sourceUrl: imageUrl,
            contentType,
            bytes: buffer.length,
            sha256: contentHash,
          };
          entry.assets[assetKey] = record;
          currentUrlIndex.set(imageUrl, record);
        } catch (error) {
          if (error instanceof SyncBudgetError) throw error;
          failed++;
          entry.assets[assetKey] = {
            sourceUrl: imageUrl,
            path: null,
            error: error instanceof Error ? error.message : String(error),
          };
          console.warn(`[failed] ${entityKey} ${assetKey}: ${entry.assets[assetKey].error}`);
        }
      }

      manifest.entities[category][sourceId] = entry;
    }
  }

  let pruned = 0;
  if (!dryRun && failed === 0) {
    await mkdir(OUTPUT_ROOT, { recursive: true });
    await writeFileAtomic(MANIFEST_PATH, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
    pruned = await pruneUnreferencedObjects(manifest);
  } else if (!dryRun && failed > 0) {
    console.warn("Manifest not replaced because at least one asset failed; the last successful manifest remains authoritative.");
  }

  console.log(
    `\nDiscovered: ${discovered}; downloaded: ${downloaded}; reused: ${reused}; deduplicated: ${deduplicated}; pruned: ${pruned}; failed: ${failed}; remote bytes: ${remoteBytesRead}; dry-run: ${dryRun}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
