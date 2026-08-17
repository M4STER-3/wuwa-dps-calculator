import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { sha256 } from "./lib/encore-client.mjs";
import { classifyNormalizedEchoCatalog } from "./lib/echo-catalog-classifier.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const RAW_ROOT = path.join(REPO_ROOT, "data", "sources", "encore", "release");
const NORMALIZED_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-normalized");
const NORMALIZED_PATH = path.join(NORMALIZED_ROOT, "normalized-source.json");
const MAX_NORMALIZED_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_DETAIL_BYTES = 8 * 1024 * 1024;
const MAX_JSON_NODES = 500_000;
const MAX_JSON_DEPTH = 32;
const MAX_ARRAY_LENGTH = 50_000;
const MAX_OBJECT_KEYS = 20_000;
const MAX_STRING_LENGTH = 2 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function fail(message) {
  throw new Error(`Echo catalog classification: ${message}`);
}

function assertNoArguments() {
  if (process.argv.length !== 2) fail("command does not accept paths, URLs, or other arguments");
}

async function lstatIfPresent(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function assertNoSymlinkComponents(target, trustedRoot) {
  const root = path.resolve(trustedRoot);
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`path escaped repository root: ${resolved}`);
  let current = root;
  const rootStats = await lstatIfPresent(root);
  if (rootStats?.isSymbolicLink()) fail(`repository root must not be a symbolic link: ${root}`);
  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    const stats = await lstatIfPresent(current);
    if (stats?.isSymbolicLink()) fail(`symbolic links are forbidden in classification paths: ${current}`);
  }
}

function validateTree(root, label) {
  const stack = [{ value: root, depth: 0, path: "$" }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_JSON_NODES) fail(`${label} exceeds ${MAX_JSON_NODES} JSON nodes`);
    if (current.depth > MAX_JSON_DEPTH) fail(`${label} exceeds JSON depth ${MAX_JSON_DEPTH}`);
    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) fail(`${label} contains oversized text at ${current.path}`);
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) fail(`${label} has oversized array at ${current.path}`);
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, path: `${current.path}[${index}]` });
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) fail(`${label} has too many object keys at ${current.path}`);
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) fail(`${label} contains forbidden key ${key}`);
      stack.push({ value: value[key], depth: current.depth + 1, path: `${current.path}.${key}` });
    }
  }
}

async function readJson(filePath, maxBytes, label, expectedHash) {
  await assertNoSymlinkComponents(filePath, REPO_ROOT);
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) fail(`${label} must be a regular file`);
  if (stats.size <= 0 || stats.size > maxBytes) fail(`${label} has invalid size ${stats.size}`);
  const bytes = await readFile(filePath);
  if (expectedHash && sha256(bytes) !== expectedHash) fail(`${label} SHA-256 does not match manifest`);
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${label} is not valid UTF-8 JSON`);
  }
  validateTree(value, label);
  return value;
}

async function loadEchoDetails() {
  const manifest = await readJson(path.join(RAW_ROOT, "manifest.json"), MAX_MANIFEST_BYTES, "RAW manifest");
  if (
    manifest?.schemaVersion !== 1 ||
    manifest?.sourceProvider !== "encore" ||
    manifest?.sourceApi !== "https://api-v2.encore.moe/api/en" ||
    manifest?.language !== "en" ||
    manifest?.dataset !== "Release"
  ) {
    fail("RAW manifest source boundary is not reviewed");
  }
  const entities = manifest?.resources?.echoes?.entities;
  if (!Array.isArray(entities) || entities.length === 0 || entities.length > 2_000) fail("RAW Echo manifest entries are invalid");
  const detailsRoot = path.join(RAW_ROOT, "echoes", "details");
  const seen = new Set();
  const details = [];
  for (const [index, entity] of entities.entries()) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) fail(`RAW Echo manifest entry ${index} is invalid`);
    if (typeof entity.sourceId !== "string" || !/^\d{1,30}$/.test(entity.sourceId) || seen.has(entity.sourceId)) {
      fail(`RAW Echo manifest entry ${index} has invalid or duplicate source ID`);
    }
    seen.add(entity.sourceId);
    if (typeof entity.detailFile !== "string" || !/^[a-f0-9]{32}\.json$/.test(entity.detailFile)) {
      fail(`RAW Echo ${entity.sourceId} has unsafe detail filename`);
    }
    if (typeof entity.detailSha256 !== "string" || !/^[a-f0-9]{64}$/.test(entity.detailSha256)) {
      fail(`RAW Echo ${entity.sourceId} has invalid detail SHA-256`);
    }
    const detailPath = path.resolve(detailsRoot, entity.detailFile);
    const relative = path.relative(detailsRoot, detailPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`RAW Echo ${entity.sourceId} path escaped detail root`);
    const detail = await readJson(detailPath, MAX_DETAIL_BYTES, `RAW Echo ${entity.sourceId}`, entity.detailSha256);
    details.push({ sourceId: entity.sourceId, detail });
  }
  return details;
}

async function writeAtomic(value) {
  await assertNoSymlinkComponents(NORMALIZED_ROOT, REPO_ROOT);
  await mkdir(NORMALIZED_ROOT, { recursive: true, mode: 0o755 });
  const serialized = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (serialized.length <= 0 || serialized.length > MAX_NORMALIZED_BYTES) fail(`classified output size ${serialized.length} is outside reviewed limit`);
  const temporaryPath = path.join(NORMALIZED_ROOT, `.echo-catalog.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serialized, { flag: "wx", mode: 0o644 });
    await rename(temporaryPath, NORMALIZED_PATH);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return serialized.length;
}

async function main() {
  assertNoArguments();
  const [snapshot, echoDetails] = await Promise.all([
    readJson(NORMALIZED_PATH, MAX_NORMALIZED_BYTES, "normalized source"),
    loadEchoDetails(),
  ]);
  const classified = classifyNormalizedEchoCatalog(snapshot, echoDetails);
  const bytes = await writeAtomic(classified);
  const states = { base: 0, phantomSkin: 0, noncanonical: 0 };
  for (const echo of classified.echoes) {
    if (echo.catalogState === "base") states.base += 1;
    else if (echo.catalogState === "phantom-skin") states.phantomSkin += 1;
    else states.noncanonical += 1;
  }
  console.log(`WUWA_ECHO_CATALOG_CLASSIFICATION=${JSON.stringify({ bytes, ...states })}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
