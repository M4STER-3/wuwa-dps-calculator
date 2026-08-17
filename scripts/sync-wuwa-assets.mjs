import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_ORIGIN = "https://api-v2.encore.moe";
const API_BASE = `${API_ORIGIN}/api/en`;
const GAME_VERSION = "Release";
const OUTPUT_ROOT = path.resolve("public/assets/wuwa");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ENTITIES_PER_CATEGORY = 1000;
const MAX_IMAGES_PER_ENTITY = 32;
const MAX_TRAVERSAL_DEPTH = 12;
const MAX_TRAVERSAL_NODES = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;

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

function normalizeId(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function safeSegment(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "asset";
}

function parseTrustedUrl(rawUrl, { api = false } = {}) {
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
  return String(entity?.Name ?? entity?.name ?? entity?.Title ?? entity?.title ?? "Unknown").slice(0, 200);
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
    headers: { Accept: accept, "User-Agent": "wuwa-dps-calculator-asset-sync/1" },
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
  return safeSegment(fieldPath.replace(/^(?:list|detail)\./, "").replaceAll(".", "-"));
}

function resolveOutputPath(category, sourceId, filename) {
  const outputPath = path.resolve(OUTPUT_ROOT, safeSegment(category), safeSegment(sourceId), safeSegment(filename));
  const relative = path.relative(OUTPUT_ROOT, outputPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved output path escaped the asset root");
  }
  return outputPath;
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

async function collectEntityImages(entity, category, config, sourceId) {
  const images = collectImageUrls(entity, "list");
  if (!config.detail) return images;

  const detailUrl = `${API_BASE}${config.endpoint}/${encodeURIComponent(sourceId)}?v=${encodeURIComponent(GAME_VERSION)}`;
  try {
    const detail = await fetchJson(detailUrl);
    mergeImageUrls(images, collectImageUrls(detail, "detail"));
  } catch (error) {
    console.warn(`[${category}] detail unavailable for ${sourceId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return images;
}

async function main() {
  const previousManifest = await loadExistingManifest();
  const manifest = {
    schemaVersion: 1,
    source: "Encore.moe",
    sourceApi: API_BASE,
    gameVersion: GAME_VERSION,
    generatedAt: new Date().toISOString(),
    categories: Object.keys(SOURCES),
    security: {
      allowedFormats: [...ALLOWED_IMAGE_TYPES.keys()],
      maxImageBytes: MAX_IMAGE_BYTES,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
    },
    entities: {},
  };

  let discovered = 0;
  let downloaded = 0;
  let reused = 0;
  let failed = 0;

  for (const [category, config] of Object.entries(SOURCES)) {
    const url = `${API_BASE}${config.endpoint}?v=${encodeURIComponent(GAME_VERSION)}`;
    console.log(`\n[${category}] syncing Release assets`);
    const payload = await fetchJson(url);
    const entities = getCollection(payload, config.collectionKeys);
    manifest.entities[category] = {};

    for (const entity of entities) {
      const sourceId = getEntityId(entity);
      if (!sourceId) {
        console.warn(`[${category}] skipped entity without stable ID`);
        continue;
      }

      const entityKey = `${category}:${sourceId}`;
      const imageUrls = await collectEntityImages(entity, category, config, sourceId);
      const entry = { sourceId, entityKey, name: getEntityName(entity), assets: {} };

      for (const [fieldPath, imageUrl] of imageUrls) {
        discovered++;
        const assetKey = manifestAssetKey(fieldPath);
        const previous = previousManifest?.entities?.[category]?.[sourceId]?.assets?.[assetKey];

        if (!force && previous?.sourceUrl === imageUrl && previous?.path) {
          const previousPath = path.resolve("public", previous.path.replace(/^\//, ""));
          const relativeToPublic = path.relative(path.resolve("public"), previousPath);
          if (!relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic) && (await fileExists(previousPath))) {
            entry.assets[assetKey] = previous;
            reused++;
            continue;
          }
        }

        if (dryRun) {
          entry.assets[assetKey] = { sourceUrl: imageUrl, path: null, status: "would-download" };
          console.log(`[dry-run] ${entityKey} ${assetKey}`);
          continue;
        }

        try {
          const { buffer, extension, contentType } = await downloadImage(imageUrl);
          const outputPath = resolveOutputPath(category, sourceId, `${assetKey}.${extension}`);
          const relativePath = `/${path.relative(path.resolve("public"), outputPath).split(path.sep).join("/")}`;
          await writeFileAtomic(outputPath, buffer);

          entry.assets[assetKey] = {
            path: relativePath,
            sourceUrl: imageUrl,
            contentType,
            bytes: buffer.length,
            sha256: createHash("sha256").update(buffer).digest("hex"),
          };
          downloaded++;
          console.log(`[saved] ${entityKey} ${assetKey}`);
        } catch (error) {
          failed++;
          entry.assets[assetKey] = { sourceUrl: imageUrl, path: null, error: error instanceof Error ? error.message : String(error) };
          console.warn(`[failed] ${entityKey} ${assetKey}: ${entry.assets[assetKey].error}`);
        }
      }

      manifest.entities[category][sourceId] = entry;
    }
  }

  if (!dryRun) {
    await mkdir(OUTPUT_ROOT, { recursive: true });
    await writeFileAtomic(MANIFEST_PATH, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  }

  console.log(`\nDiscovered: ${discovered}; downloaded: ${downloaded}; reused: ${reused}; failed: ${failed}; dry-run: ${dryRun}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
