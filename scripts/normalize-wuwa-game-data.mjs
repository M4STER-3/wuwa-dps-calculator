import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { sha256 } from "./lib/encore-client.mjs";
import { normalizeEncoreSourceSnapshot, normalizeSourceId } from "./lib/encore-normalizer.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const RAW_ROOT = path.join(REPO_ROOT, "data", "sources", "encore", "release");
const OUTPUT_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-normalized");
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "normalized-source.json");
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_DETAIL_BYTES = 8 * 1024 * 1024;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 200_000;
const MAX_ARRAY_LENGTH = 10_000;
const MAX_OBJECT_KEYS = 10_000;
const MAX_KEY_LENGTH = 256;
const MAX_STRING_LENGTH = 2 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const RESOURCE_NAMES = ["characters", "weapons", "echoes"];

function fail(message) {
  throw new Error(message);
}

function assertNoArguments() {
  if (process.argv.length > 2) fail("Normalizer does not accept filesystem or network arguments");
}

async function lstatIfPresent(filePath) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function assertNoSymlinkComponents(targetPath, trustedRoot) {
  const root = path.resolve(trustedRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`Path escaped trusted root: ${target}`);

  let current = root;
  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    const stats = await lstatIfPresent(current);
    if (!stats) continue;
    if (stats.isSymbolicLink()) fail(`Symbolic link forbidden in normalized data path: ${current}`);
  }
}

function validateJsonTree(root, label) {
  const stack = [{ value: root, depth: 0, path: "$" }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_JSON_NODES) fail(`${label} exceeded JSON node limit`);
    if (current.depth > MAX_JSON_DEPTH) fail(`${label} exceeded JSON depth limit`);

    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) fail(`${label} string too long at ${current.path}`);
      continue;
    }
    if (value === null || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) fail(`${label} array too large at ${current.path}`);
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, path: `${current.path}[${index}]` });
      }
      continue;
    }

    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) fail(`${label} object has too many keys at ${current.path}`);
    for (const key of keys) {
      if (key.length > MAX_KEY_LENGTH) fail(`${label} key too long at ${current.path}`);
      if (DANGEROUS_KEYS.has(key)) fail(`${label} contains forbidden key ${key}`);
      stack.push({ value: value[key], depth: current.depth + 1, path: `${current.path}.${key}` });
    }
  }
}

async function readJsonFile(filePath, maxBytes, label, expectedHash) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(REPO_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} escaped repository root`);
  await assertNoSymlinkComponents(resolved, REPO_ROOT);
  const stats = await lstat(resolved);
  if (!stats.isFile() || stats.isSymbolicLink()) fail(`${label} must be a regular file`);
  if (stats.size <= 0 || stats.size > maxBytes) fail(`${label} has invalid size ${stats.size}`);
  const raw = await readFile(resolved);
  if (expectedHash && sha256(raw) !== expectedHash) fail(`${label} SHA-256 does not match RAW manifest`);
  let json;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    fail(`${label} is not valid UTF-8 JSON`);
  }
  validateJsonTree(json, label);
  return json;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") fail("RAW manifest must be an object");
  if (manifest.schemaVersion !== 1) fail("Unsupported RAW manifest schema");
  if (manifest.sourceProvider !== "encore") fail("Unexpected RAW source provider");
  if (manifest.sourceApi !== "https://api-v2.encore.moe/api/en") fail("Unexpected RAW source API");
  if (manifest.language !== "en" || manifest.dataset !== "Release") fail("Unexpected RAW language/dataset");
  if (!manifest.resources || typeof manifest.resources !== "object") fail("RAW manifest resources missing");

  for (const resourceName of RESOURCE_NAMES) {
    const resource = manifest.resources[resourceName];
    if (!resource || !Array.isArray(resource.entities)) fail(`RAW manifest ${resourceName} metadata missing`);
    if (resource.count !== resource.entities.length) fail(`RAW manifest ${resourceName} count mismatch`);
    const seen = new Set();
    for (const entity of resource.entities) {
      if (!entity || typeof entity !== "object") fail(`RAW manifest ${resourceName} entity metadata invalid`);
      const sourceId = normalizeSourceId(entity.sourceId, `${resourceName} source id`);
      if (seen.has(sourceId)) fail(`RAW manifest duplicates ${resourceName}:${sourceId}`);
      seen.add(sourceId);
      if (typeof entity.detailFile !== "string" || !/^[a-f0-9]{32}\.json$/.test(entity.detailFile)) {
        fail(`RAW manifest ${resourceName}:${sourceId} has unsafe detail filename`);
      }
      if (typeof entity.detailSha256 !== "string" || !/^[a-f0-9]{64}$/.test(entity.detailSha256)) {
        fail(`RAW manifest ${resourceName}:${sourceId} has invalid detail SHA-256`);
      }
    }
  }
  return manifest;
}

async function loadResourceDetails(manifest, resourceName) {
  const resource = manifest.resources[resourceName];
  const detailsRoot = path.join(RAW_ROOT, resourceName, "details");
  const result = [];
  for (const entity of resource.entities) {
    const sourceId = normalizeSourceId(entity.sourceId, `${resourceName} source id`);
    const filePath = path.resolve(detailsRoot, entity.detailFile);
    const relative = path.relative(detailsRoot, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${resourceName}:${sourceId} detail path escaped resource root`);
    const detail = await readJsonFile(
      filePath,
      MAX_DETAIL_BYTES,
      `${resourceName}:${sourceId} detail`,
      entity.detailSha256,
    );
    result.push({ sourceId, detail });
  }
  return result;
}

async function writeOutputAtomic(value) {
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o755 });
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  const realRepo = await realpath(REPO_ROOT);
  const realOutput = await realpath(OUTPUT_ROOT);
  const relative = path.relative(realRepo, realOutput);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("Normalizer output escaped repository root");

  const tempPath = `${OUTPUT_PATH}.${randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(tempPath, serialized, { flag: "wx", mode: 0o644 });
    await rename(tempPath, OUTPUT_PATH);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
  return Buffer.byteLength(serialized);
}

async function main() {
  assertNoArguments();
  await assertNoSymlinkComponents(RAW_ROOT, REPO_ROOT);
  const manifest = validateManifest(
    await readJsonFile(path.join(RAW_ROOT, "manifest.json"), MAX_MANIFEST_BYTES, "RAW manifest"),
  );

  const [characterDetails, weaponDetails, echoDetails] = await Promise.all([
    loadResourceDetails(manifest, "characters"),
    loadResourceDetails(manifest, "weapons"),
    loadResourceDetails(manifest, "echoes"),
  ]);

  const normalized = normalizeEncoreSourceSnapshot({
    manifest,
    characterDetails,
    weaponDetails,
    echoDetails,
  });
  const bytes = await writeOutputAtomic(normalized);
  console.log(
    `WUWA_GAME_DATA_NORMALIZE_REPORT=${JSON.stringify({
      counts: normalized.counts,
      bytes,
      output: ".tmp/wuwa-game-data-normalized/normalized-source.json",
      diagnostics: normalized.diagnostics.map((entry) => entry.code),
    })}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
