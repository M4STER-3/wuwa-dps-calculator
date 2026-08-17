import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CATEGORIES = ["characters", "weapons", "echoes"];
const REQUIRED_ROLES = Object.freeze({
  characters: ["list-roleheadicon"],
  weapons: ["list-icon"],
  echoes: ["list-icon"],
});
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ENTITIES_PER_CATEGORY = 1_000;
const MAX_TOTAL_ASSETS = 10_000;
const MAX_ASSETS_PER_ENTITY = 96;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_ID_LENGTH = 128;
const MAX_ASSET_KEY_LENGTH = 1_024;
const EXPECTED_STORAGE_ROOT = "/assets/wuwa/objects";
const EXPECTED_SOURCE_API = "https://api-v2.encore.moe/api/en";
const DENIED_ROLE_PATTERN = /(?:^|[._-])(?:ad|ads|advert|advertisement|advertising|sponsor|sponsored|tracking|tracker|pixel|promo|promotion)(?:[._-]|$)/i;
const CONTENT_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const EXPECTED_SECURITY = Object.freeze({
  maxImageBytes: MAX_IMAGE_BYTES,
  maxRemoteBytesPerRun: 1024 * 1024 * 1024,
  maxAssetsPerRun: MAX_TOTAL_ASSETS,
  maxImagesPerEntity: MAX_ASSETS_PER_ENTITY,
});

function fail(message) {
  throw new Error(`WuWa asset verification failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function assertExactKeys(record, allowed, label) {
  for (const key of Object.keys(record)) {
    if (DANGEROUS_KEYS.has(key)) fail(`${label} contains forbidden key ${key}`);
    if (!allowed.has(key)) fail(`${label} contains unexpected key ${key}`);
  }
}

function assertSafeSourceId(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SOURCE_ID_LENGTH ||
    /[\u0000-\u001f\u007f-\u009f]/.test(value) ||
    DANGEROUS_KEYS.has(value)
  ) {
    fail(`${label} is not a safe source ID`);
  }
  return value;
}

function assertAssetKey(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ASSET_KEY_LENGTH ||
    !/^[a-z0-9._-]+$/.test(value) ||
    DANGEROUS_KEYS.has(value)
  ) {
    fail(`${label} is not a normalized asset key`);
  }
  if (DENIED_ROLE_PATTERN.test(value)) fail(`${label} is an advertisement/tracking role`);
  return value;
}

function parseTrustedSourceUrl(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096) {
    fail(`${label} must be a bounded URL`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} is not a valid URL`);
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    (host !== "encore.moe" && !host.endsWith(".encore.moe"))
  ) {
    fail(`${label} escapes the reviewed Encore image boundary`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function signatureMatches(bytes, contentType) {
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

async function assertRegularPath(target, label, expectedType) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) fail(`${label} must not be a symbolic link`);
  if (expectedType === "file" && !info.isFile()) fail(`${label} must be a regular file`);
  if (expectedType === "directory" && !info.isDirectory()) fail(`${label} must be a directory`);
  return info;
}

function parseManifest(raw) {
  if (raw.length === 0 || raw.length > MAX_MANIFEST_BYTES) fail("manifest has invalid size");
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    fail("manifest is not valid UTF-8 JSON");
  }
  return assertRecord(manifest, "manifest");
}

function validateManifestEnvelope(manifest) {
  assertExactKeys(
    manifest,
    new Set([
      "schemaVersion",
      "source",
      "sourceApi",
      "gameVersion",
      "generatedAt",
      "categories",
      "storage",
      "security",
      "entities",
    ]),
    "manifest",
  );
  if (manifest.schemaVersion !== 2) fail("manifest schemaVersion must be 2");
  if (manifest.source !== "Encore.moe") fail("manifest source must be Encore.moe");
  if (manifest.sourceApi !== EXPECTED_SOURCE_API) fail("manifest source API is not reviewed");
  if (manifest.gameVersion !== "Release") fail("manifest gameVersion must be Release");
  if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    fail("manifest generatedAt must be a valid timestamp");
  }
  if (
    !Array.isArray(manifest.categories) ||
    manifest.categories.length !== CATEGORIES.length ||
    new Set(manifest.categories).size !== CATEGORIES.length ||
    CATEGORIES.some((category) => !manifest.categories.includes(category))
  ) {
    fail("manifest categories must be exactly characters, weapons and echoes");
  }

  const storage = assertRecord(manifest.storage, "manifest.storage");
  assertExactKeys(storage, new Set(["strategy", "root"]), "manifest.storage");
  if (storage.strategy !== "sha256-content-addressed" || storage.root !== EXPECTED_STORAGE_ROOT) {
    fail("manifest storage strategy/root is not reviewed");
  }

  const security = assertRecord(manifest.security, "manifest.security");
  assertExactKeys(
    security,
    new Set([
      "allowedFormats",
      "maxImageBytes",
      "maxRemoteBytesPerRun",
      "maxAssetsPerRun",
      "maxImagesPerEntity",
      "optionalMissingHttp404",
    ]),
    "manifest.security",
  );
  if (
    !Array.isArray(security.allowedFormats) ||
    security.allowedFormats.length !== 3 ||
    new Set(security.allowedFormats).size !== 3 ||
    [...CONTENT_TYPES.keys()].some((type) => !security.allowedFormats.includes(type))
  ) {
    fail("manifest allowedFormats must be exactly PNG/JPEG/WebP");
  }
  for (const [key, expected] of Object.entries(EXPECTED_SECURITY)) {
    if (security[key] !== expected) fail(`manifest.security.${key} changed unexpectedly`);
  }
  if (!Number.isInteger(security.optionalMissingHttp404) || security.optionalMissingHttp404 < 0) {
    fail("manifest.security.optionalMissingHttp404 must be a non-negative integer");
  }
}

export async function verifyWuWaAssetTree(rootPath = path.join(process.cwd(), "public", "assets", "wuwa")) {
  const root = path.resolve(rootPath);
  const objectsRoot = path.join(root, "objects");
  const manifestPath = path.join(root, "manifest.json");

  await assertRegularPath(root, "asset root", "directory");
  await assertRegularPath(objectsRoot, "asset object store", "directory");
  await assertRegularPath(manifestPath, "asset manifest", "file");

  const manifestRaw = await readFile(manifestPath);
  const manifest = parseManifest(manifestRaw);
  validateManifestEnvelope(manifest);

  const entitiesRoot = assertRecord(manifest.entities, "manifest.entities");
  assertExactKeys(entitiesRoot, new Set(CATEGORIES), "manifest.entities");

  const referencedPaths = new Set();
  const shaTypes = new Map();
  const formats = new Map();
  const entityCounts = {};
  let logicalAssets = 0;
  let logicalBytes = 0;
  let maxAssetsOnEntity = 0;

  for (const category of CATEGORIES) {
    const categoryRecord = assertRecord(entitiesRoot[category], `manifest.entities.${category}`);
    const entries = Object.entries(categoryRecord);
    if (entries.length > MAX_ENTITIES_PER_CATEGORY) fail(`${category} exceeds entity cap`);
    entityCounts[category] = entries.length;

    for (const [sourceIdKey, rawEntity] of entries) {
      const sourceId = assertSafeSourceId(sourceIdKey, `${category} source ID`);
      const entity = assertRecord(rawEntity, `${category}:${sourceId}`);
      assertExactKeys(entity, new Set(["sourceId", "entityKey", "name", "assets"]), `${category}:${sourceId}`);
      if (entity.sourceId !== sourceId) fail(`${category}:${sourceId} sourceId mismatch`);
      if (entity.entityKey !== `${category}:${sourceId}`) fail(`${category}:${sourceId} entityKey mismatch`);
      if (
        typeof entity.name !== "string" ||
        entity.name.length > 200 ||
        /[\u0000-\u001f\u007f-\u009f]/.test(entity.name)
      ) {
        fail(`${category}:${sourceId} has an invalid display name`);
      }

      const assets = assertRecord(entity.assets, `${category}:${sourceId}.assets`);
      const assetEntries = Object.entries(assets);
      if (assetEntries.length > MAX_ASSETS_PER_ENTITY) fail(`${category}:${sourceId} exceeds per-entity asset cap`);
      maxAssetsOnEntity = Math.max(maxAssetsOnEntity, assetEntries.length);

      for (const requiredRole of REQUIRED_ROLES[category]) {
        if (!Object.prototype.hasOwnProperty.call(assets, requiredRole)) {
          fail(`${category}:${sourceId} is missing required role ${requiredRole}`);
        }
      }

      for (const [rawAssetKey, rawAsset] of assetEntries) {
        const assetKey = assertAssetKey(rawAssetKey, `${category}:${sourceId} asset key`);
        const asset = assertRecord(rawAsset, `${category}:${sourceId}:${assetKey}`);
        assertExactKeys(
          asset,
          new Set(["path", "sourceUrl", "contentType", "bytes", "sha256"]),
          `${category}:${sourceId}:${assetKey}`,
        );

        logicalAssets += 1;
        if (logicalAssets > MAX_TOTAL_ASSETS) fail("manifest exceeds total asset cap");
        if (!Number.isInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_IMAGE_BYTES) {
          fail(`${category}:${sourceId}:${assetKey} has invalid byte size`);
        }
        if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
          fail(`${category}:${sourceId}:${assetKey} has invalid SHA-256`);
        }
        const extension = CONTENT_TYPES.get(asset.contentType);
        if (!extension) fail(`${category}:${sourceId}:${assetKey} has unsupported MIME type`);
        const expectedPath = `${EXPECTED_STORAGE_ROOT}/${asset.sha256}.${extension}`;
        if (asset.path !== expectedPath) fail(`${category}:${sourceId}:${assetKey} object path mismatch`);
        parseTrustedSourceUrl(asset.sourceUrl, `${category}:${sourceId}:${assetKey}.sourceUrl`);

        const previousType = shaTypes.get(asset.sha256);
        if (previousType && previousType !== asset.contentType) {
          fail(`SHA-256 ${asset.sha256} is associated with conflicting MIME types`);
        }
        shaTypes.set(asset.sha256, asset.contentType);

        const filePath = path.join(root, "objects", `${asset.sha256}.${extension}`);
        const relative = path.relative(objectsRoot, filePath);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("object path escaped object store");
        const info = await assertRegularPath(filePath, asset.path, "file");
        if (info.size !== asset.bytes) fail(`${asset.path} byte-size mismatch`);
        const bytes = await readFile(filePath);
        if (!signatureMatches(bytes, asset.contentType)) fail(`${asset.path} signature does not match MIME type`);
        if (sha256(bytes) !== asset.sha256) fail(`${asset.path} SHA-256 mismatch`);

        referencedPaths.add(asset.path);
        logicalBytes += asset.bytes;
        formats.set(asset.contentType, (formats.get(asset.contentType) ?? 0) + 1);
      }
    }
  }

  const objectNames = await readdir(objectsRoot);
  let physicalBytes = 0;
  const objectPaths = new Set();
  for (const name of objectNames) {
    if (!/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(name)) fail(`unexpected object-store filename ${name}`);
    const filePath = path.join(objectsRoot, name);
    const info = await assertRegularPath(filePath, name, "file");
    physicalBytes += info.size;
    objectPaths.add(`${EXPECTED_STORAGE_ROOT}/${name}`);
  }

  for (const referenced of referencedPaths) {
    if (!objectPaths.has(referenced)) fail(`referenced object is missing: ${referenced}`);
  }
  for (const objectPath of objectPaths) {
    if (!referencedPaths.has(objectPath)) fail(`unreferenced object remains: ${objectPath}`);
  }

  const manifestInfo = await stat(manifestPath);
  return Object.freeze({
    entityCounts: Object.freeze(entityCounts),
    logicalAssets,
    uniqueObjects: objectPaths.size,
    deduplicatedAssociations: logicalAssets - objectPaths.size,
    logicalBytes,
    physicalBytes,
    manifestBytes: manifestInfo.size,
    maxAssetsOnEntity,
    optionalMissingHttp404: manifest.security.optionalMissingHttp404,
    formatAssociations: Object.freeze(Object.fromEntries([...formats.entries()].sort())),
  });
}

async function main() {
  const summary = await verifyWuWaAssetTree();
  console.log(`WUWA_ASSET_VERIFY_REPORT=${JSON.stringify(summary)}`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
