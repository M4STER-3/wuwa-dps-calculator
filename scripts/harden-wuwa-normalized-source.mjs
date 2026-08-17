import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { sha256 } from "./lib/encore-client.mjs";
import { hardenNormalizedSourceSnapshot } from "./lib/normalized-source-hardening.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const RAW_ROOT = path.join(REPO_ROOT, "data", "sources", "encore", "release");
const NORMALIZED_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-normalized");
const NORMALIZED_PATH = path.join(NORMALIZED_ROOT, "normalized-source.json");
const MAX_NORMALIZED_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_DETAIL_BYTES = 8 * 1024 * 1024;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_NODES = 500_000;
const MAX_ARRAY_LENGTH = 50_000;
const MAX_OBJECT_KEYS = 20_000;
const MAX_KEY_LENGTH = 256;
const MAX_STRING_LENGTH = 2 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function fail(message) {
  throw new Error(`Normalized source hardening: ${message}`);
}

function assertNoArguments() {
  if (process.argv.length !== 2) fail("command does not accept filesystem, network, or other arguments");
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
  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    const stats = await lstatIfPresent(current);
    if (stats?.isSymbolicLink()) fail(`symbolic links are forbidden in hardening paths: ${current}`);
  }
}

function validateJsonTree(root, label) {
  const stack = [{ value: root, depth: 0, label: "$" }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_JSON_NODES) fail(`${label} exceeds ${MAX_JSON_NODES} JSON nodes`);
    if (current.depth > MAX_JSON_DEPTH) fail(`${label} exceeds JSON depth ${MAX_JSON_DEPTH}`);
    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING_LENGTH) fail(`${label} contains an oversized string at ${current.label}`);
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) fail(`${label} has an oversized array at ${current.label}`);
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, label: `${current.label}[${index}]` });
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_OBJECT_KEYS) fail(`${label} has too many object keys at ${current.label}`);
    for (const key of keys) {
      if (key.length > MAX_KEY_LENGTH) fail(`${label} contains an oversized key at ${current.label}`);
      if (DANGEROUS_KEYS.has(key)) fail(`${label} contains forbidden key ${key}`);
      stack.push({ value: value[key], depth: current.depth + 1, label: `${current.label}.${key}` });
    }
  }
}

async function readJsonFile(filePath, maxBytes, label, expectedHash) {
  await assertNoSymlinkComponents(filePath, REPO_ROOT);
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) fail(`${label} must be a regular file`);
  if (stats.size <= 0 || stats.size > maxBytes) fail(`${label} has invalid size ${stats.size}`);
  const raw = await readFile(filePath);
  if (expectedHash && sha256(raw) !== expectedHash) fail(`${label} SHA-256 does not match the RAW manifest`);
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    fail(`${label} is not valid UTF-8 JSON`);
  }
  validateJsonTree(value, label);
  return value;
}

async function loadEchoDetails() {
  const manifest = await readJsonFile(
    path.join(RAW_ROOT, "manifest.json"),
    MAX_MANIFEST_BYTES,
    "RAW manifest",
  );
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
  if (!Array.isArray(entities) || entities.length > 2_000) fail("RAW manifest Echo entities are invalid");
  const seen = new Set();
  const detailsRoot = path.join(RAW_ROOT, "echoes", "details");
  const details = [];
  for (const [index, entity] of entities.entries()) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) fail(`Echo manifest entity ${index} is invalid`);
    if (typeof entity.sourceId !== "string" || entity.sourceId.length === 0 || entity.sourceId.length > 128) {
      fail(`Echo manifest entity ${index} has invalid source ID`);
    }
    if (seen.has(entity.sourceId)) fail(`Echo manifest duplicates source ID ${entity.sourceId}`);
    seen.add(entity.sourceId);
    if (typeof entity.detailFile !== "string" || !/^[a-f0-9]{32}\.json$/.test(entity.detailFile)) {
      fail(`Echo ${entity.sourceId} has unsafe detail filename`);
    }
    if (typeof entity.detailSha256 !== "string" || !/^[a-f0-9]{64}$/.test(entity.detailSha256)) {
      fail(`Echo ${entity.sourceId} has invalid detail SHA-256`);
    }
    const detailPath = path.resolve(detailsRoot, entity.detailFile);
    const relative = path.relative(detailsRoot, detailPath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail(`Echo ${entity.sourceId} detail path escaped root`);
    const detail = await readJsonFile(
      detailPath,
      MAX_DETAIL_BYTES,
      `Echo ${entity.sourceId} RAW detail`,
      entity.detailSha256,
    );
    if (detail.MonsterId !== undefined && String(detail.MonsterId) !== entity.sourceId) {
      fail(`Echo ${entity.sourceId} RAW detail ID mismatch`);
    }
    details.push({ sourceId: entity.sourceId, detail });
  }
  return details;
}

async function writeNormalizedAtomic(value) {
  await assertNoSymlinkComponents(NORMALIZED_ROOT, REPO_ROOT);
  await mkdir(NORMALIZED_ROOT, { recursive: true, mode: 0o755 });
  await assertNoSymlinkComponents(NORMALIZED_ROOT, REPO_ROOT);
  const serialized = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (serialized.length <= 0 || serialized.length > MAX_NORMALIZED_BYTES) {
    fail(`hardened normalized output size ${serialized.length} is outside the reviewed limit`);
  }
  const temporaryPath = path.join(NORMALIZED_ROOT, `.hardened.${randomUUID()}.tmp`);
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
  const [normalized, echoDetails] = await Promise.all([
    readJsonFile(NORMALIZED_PATH, MAX_NORMALIZED_BYTES, "normalized source"),
    loadEchoDetails(),
  ]);
  const hardened = hardenNormalizedSourceSnapshot(normalized, echoDetails);
  const bytes = await writeNormalizedAtomic(hardened);
  console.log(
    `WUWA_NORMALIZED_SOURCE_HARDENING=${JSON.stringify({
      bytes,
      characters: hardened.characters.length,
      weapons: hardened.weapons.length,
      echoes: hardened.echoes.length,
      sonataSets: hardened.sonataSets.length,
      stableSonataIds: hardened.sonataSets.filter((entry) => entry.sourceId !== undefined).length,
      diagnostics: hardened.diagnostics.map((entry) => entry.code),
    })}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
