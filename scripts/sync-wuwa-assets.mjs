import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const API_BASE = "https://api-v2.encore.moe/api/en";
const GAME_VERSION = "Release";
const OUTPUT_ROOT = path.resolve("public/assets/wuwa");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const SOURCES = {
  characters: {
    endpoint: "/character",
    collectionKeys: ["roleList"],
  },
  weapons: {
    endpoint: "/weapon",
    collectionKeys: ["weapons"],
  },
  echoes: {
    endpoint: "/echo",
    collectionKeys: ["Echo", "echoes"],
  },
  monsters: {
    endpoint: "/monster",
    collectionKeys: ["monsterList", "monsters"],
  },
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

function isAllowedImageUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "encore.moe" || host.endsWith(".encore.moe");
}

function looksLikeImageField(key, value) {
  if (typeof value !== "string" || !value.startsWith("https://")) return false;
  const lowerKey = key.toLowerCase();
  const lowerValue = value.toLowerCase().split("?")[0];
  return (
    /(?:icon|image|picture|portrait|head|avatar|sprite|art|logo|texture)/i.test(lowerKey) ||
    /\.(?:png|jpe?g|webp|gif|avif)$/i.test(lowerValue)
  );
}

function collectImageUrls(value, prefix = "root", found = new Map()) {
  if (!value || typeof value !== "object") return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageUrls(item, `${prefix}.${index}`, found));
    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    const fieldPath = `${prefix}.${key}`;
    if (looksLikeImageField(key, child) && isAllowedImageUrl(child)) {
      found.set(fieldPath, child);
    } else if (child && typeof child === "object") {
      collectImageUrls(child, fieldPath, found);
    }
  }

  return found;
}

function getCollection(payload, collectionKeys) {
  for (const key of collectionKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error(`Unexpected Encore response; none of [${collectionKeys.join(", ")}] is an array.`);
}

function getEntityId(entity) {
  return normalizeId(entity?.Id ?? entity?.id ?? entity?.ID);
}

function getEntityName(entity) {
  return String(entity?.Name ?? entity?.name ?? entity?.Title ?? entity?.title ?? "Unknown");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Encore API returned ${response.status} for ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Expected JSON from ${url}, got ${contentType || "unknown content type"}`);
  }
  return response.json();
}

function detectImage(buffer, contentType) {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const bytes = buffer.subarray(0, 16);
  const isPng = bytes.length >= 8 && bytes.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isGif = buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const isAvif = buffer.subarray(4, 12).toString("ascii").includes("ftypavif") || buffer.subarray(4, 12).toString("ascii").includes("ftypavis");

  if (isPng && (!ct || ct === "image/png" || ct === "application/octet-stream")) return { extension: "png", contentType: "image/png" };
  if (isJpeg && (!ct || ct === "image/jpeg" || ct === "image/jpg" || ct === "application/octet-stream")) return { extension: "jpg", contentType: "image/jpeg" };
  if (isWebp && (!ct || ct === "image/webp" || ct === "application/octet-stream")) return { extension: "webp", contentType: "image/webp" };
  if (isGif && (!ct || ct === "image/gif" || ct === "application/octet-stream")) return { extension: "gif", contentType: "image/gif" };
  if (isAvif && (!ct || ct === "image/avif" || ct === "application/octet-stream")) return { extension: "avif", contentType: "image/avif" };
  throw new Error(`Rejected file: bytes/content-type do not identify an allowed image (${ct || "no content-type"})`);
}

async function downloadImage(url) {
  if (!isAllowedImageUrl(url)) throw new Error(`Rejected non-Encore image host: ${url}`);
  const response = await fetch(url, {
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Image download returned ${response.status}: ${url}`);

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes: ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Rejected image size ${buffer.length}: ${url}`);
  }

  const detected = detectImage(buffer, response.headers.get("content-type"));
  return { buffer, ...detected };
}

async function loadExistingManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

function manifestAssetKey(fieldPath) {
  return safeSegment(fieldPath.replace(/^root\./, "").replaceAll(".", "-"));
}

async function main() {
  const previousManifest = await loadExistingManifest();
  const manifest = {
    schemaVersion: 1,
    source: "Encore.moe",
    sourceApi: API_BASE,
    gameVersion: GAME_VERSION,
    generatedAt: new Date().toISOString(),
    entities: {},
  };

  let discovered = 0;
  let downloaded = 0;
  let failed = 0;

  for (const [category, config] of Object.entries(SOURCES)) {
    const url = `${API_BASE}${config.endpoint}?v=${encodeURIComponent(GAME_VERSION)}`;
    console.log(`\n[${category}] ${url}`);
    const payload = await fetchJson(url);
    const entities = getCollection(payload, config.collectionKeys);
    manifest.entities[category] = {};

    for (const entity of entities) {
      const sourceId = getEntityId(entity);
      if (!sourceId) {
        console.warn(`[${category}] skipped entity without stable ID: ${getEntityName(entity)}`);
        continue;
      }

      const entityKey = `${category}:${sourceId}`;
      const imageUrls = collectImageUrls(entity);
      const entry = {
        sourceId,
        entityKey,
        name: getEntityName(entity),
        assets: {},
      };

      for (const [fieldPath, imageUrl] of imageUrls) {
        discovered++;
        const assetKey = manifestAssetKey(fieldPath);
        const previous = previousManifest?.entities?.[category]?.[sourceId]?.assets?.[assetKey];

        if (!force && previous?.sourceUrl === imageUrl && previous?.path) {
          entry.assets[assetKey] = previous;
          continue;
        }

        if (dryRun) {
          entry.assets[assetKey] = { sourceUrl: imageUrl, path: null, status: "would-download" };
          console.log(`[dry-run] ${entityKey} ${assetKey}`);
          continue;
        }

        try {
          const { buffer, extension, contentType } = await downloadImage(imageUrl);
          const relativePath = path.posix.join("/assets/wuwa", category, safeSegment(sourceId), `${assetKey}.${extension}`);
          const outputPath = path.resolve("public", relativePath.slice(1));
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, buffer);

          entry.assets[assetKey] = {
            path: relativePath,
            sourceUrl: imageUrl,
            contentType,
            bytes: buffer.length,
            sha256: createHash("sha256").update(buffer).digest("hex"),
          };
          downloaded++;
          console.log(`[saved] ${entityKey} ${assetKey} -> ${relativePath}`);
        } catch (error) {
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

  if (!dryRun) {
    await mkdir(OUTPUT_ROOT, { recursive: true });
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log(`\nDiscovered: ${discovered}; downloaded: ${downloaded}; failed: ${failed}; dry-run: ${dryRun}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
