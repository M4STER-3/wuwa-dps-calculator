import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = path.resolve(process.cwd());
const MODES = new Map([
  ["--generated", path.join(REPO_ROOT, ".tmp", "wuwa-game-database-v1", "game-database-v1.json")],
  ["--artifact", path.join(REPO_ROOT, ".tmp", "game-database-promotion-download", "game-database-v1.json")],
  ["--public", path.join(REPO_ROOT, "public", "data", "wuwa", "game-database-v1.json")],
]);
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_NODES = 250_000;
const MAX_DEPTH = 32;
const MAX_ARRAY = 10_000;
const MAX_KEYS = 10_000;
const MAX_STRING = 100_000;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const EXECUTABLE_SOURCE_KEYS = /^(?:DamageList|Conditions?|Formula)$/i;
const SCRIPT_LIKE = /<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i;
const HTTP_URL = /https?:\/\//i;
const HASH = /^[a-f0-9]{64}$/;
const CANONICAL_ID = /^[a-z0-9:-]{1,200}$/;
const ENCORE_ID = /^\d{1,30}$/;

function fail(message) {
  throw new Error(`Generated GameDatabase verification failed: ${message}`);
}

async function lstatIfPresent(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function assertNoSymlinkComponents(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(REPO_ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`path escaped reviewed repository root: ${resolved}`);
  }
  let current = REPO_ROOT;
  const rootStats = await lstatIfPresent(REPO_ROOT);
  if (rootStats?.isSymbolicLink()) fail("repository root must not be a symbolic link");
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stats = await lstatIfPresent(current);
    if (stats?.isSymbolicLink()) fail(`symbolic links are forbidden: ${current}`);
  }
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, max = MAX_ARRAY) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`);
  return value;
}

function safeCanonicalId(value, label) {
  if (typeof value !== "string" || !CANONICAL_ID.test(value)) fail(`${label} is not a reviewed canonical ID`);
  return value;
}

function safeEncoreId(value, label) {
  if (typeof value !== "string" || !ENCORE_ID.test(value)) fail(`${label} is not a reviewed Encore ID`);
  return value;
}

function validateTree(root) {
  const stack = [{ value: root, depth: 0, label: "$" }];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    nodes += 1;
    if (nodes > MAX_NODES) fail(`JSON exceeds ${MAX_NODES} nodes`);
    if (current.depth > MAX_DEPTH) fail(`JSON exceeds depth ${MAX_DEPTH}`);
    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING) fail(`oversized string at ${current.label}`);
      if (HTTP_URL.test(value)) fail(`HTTP(S) URL leaked at ${current.label}`);
      if (SCRIPT_LIKE.test(value)) fail(`script-like text found at ${current.label}`);
      continue;
    }
    if (value === null || typeof value !== "object") {
      if (typeof value === "number" && !Number.isFinite(value)) fail(`non-finite number at ${current.label}`);
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY) fail(`oversized array at ${current.label}`);
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, label: `${current.label}[${index}]` });
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_KEYS) fail(`object has too many keys at ${current.label}`);
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) fail(`dangerous object key ${key} at ${current.label}`);
      if (EXECUTABLE_SOURCE_KEYS.test(key)) fail(`executable-looking source key ${key} leaked at ${current.label}`);
      stack.push({ value: value[key], depth: current.depth + 1, label: `${current.label}.${key}` });
    }
  }
  return nodes;
}

function validateSource(entity, label, manifest) {
  const externalIds = record(entity.externalIds, `${label}.externalIds`);
  const encoreId = safeEncoreId(externalIds.encore, `${label}.externalIds.encore`);
  if (externalIds.wuwa !== undefined) safeEncoreId(externalIds.wuwa, `${label}.externalIds.wuwa`);
  const source = record(entity.source, `${label}.source`);
  if (source.provider !== "encore" || source.dataset !== "Release" || source.language !== "en") {
    fail(`${label}.source escaped the reviewed Encore/en/Release boundary`);
  }
  if (source.externalId !== encoreId) fail(`${label}.source.externalId does not match externalIds.encore`);
  if (source.importedAt !== manifest.sourceImportedAt) fail(`${label}.source.importedAt does not match manifest sourceImportedAt`);
  if (typeof source.sourceHash !== "string" || !HASH.test(source.sourceHash)) fail(`${label}.source.sourceHash is not SHA-256`);
  return encoreId;
}

function validateFamily(entries, family, expectedKind, manifest, expectedCount) {
  const list = array(entries, family, 2_000);
  if (list.length !== expectedCount) fail(`${family} count does not match manifest`);
  const ids = new Set();
  const encoreIds = new Set();
  for (const [index, raw] of list.entries()) {
    const entity = record(raw, `${family}[${index}]`);
    if (entity.kind !== expectedKind) fail(`${family}[${index}].kind must be ${expectedKind}`);
    const id = safeCanonicalId(entity.id, `${family}[${index}].id`);
    if (ids.has(id)) fail(`${family} duplicates canonical ID ${id}`);
    ids.add(id);
    if (typeof entity.name !== "string" || entity.name.trim().length === 0 || entity.name.length > 200) {
      fail(`${family}[${index}].name is invalid`);
    }
    const encoreId = validateSource(entity, `${family}[${index}]`, manifest);
    if (encoreIds.has(encoreId)) fail(`${family} duplicates Encore ID ${encoreId}`);
    encoreIds.add(encoreId);
  }
  return list;
}

function validateDatabase(root) {
  const database = record(root, "database");
  const manifest = record(database.manifest, "manifest");
  if (manifest.schemaVersion !== 1 || manifest.dataset !== "Release" || manifest.sourceProvider !== "encore") {
    fail("manifest escaped reviewed schema/provider/dataset boundary");
  }
  if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) fail("manifest.generatedAt is invalid");
  if (typeof manifest.sourceImportedAt !== "string" || !Number.isFinite(Date.parse(manifest.sourceImportedAt))) fail("manifest.sourceImportedAt is invalid");
  const counts = record(manifest.counts, "manifest.counts");
  for (const key of ["characters", "weapons", "echoes", "sonataSets"]) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0 || counts[key] > 2_000) fail(`manifest.counts.${key} is invalid`);
  }

  validateFamily(database.characters, "characters", "character", manifest, counts.characters);
  validateFamily(database.weapons, "weapons", "weapon", manifest, counts.weapons);
  const echoes = validateFamily(database.echoes, "echoes", "echo", manifest, counts.echoes);
  const sonataSets = validateFamily(database.sonataSets, "sonataSets", "sonata-set", manifest, counts.sonataSets);
  const sonataIds = new Set(sonataSets.map((entry) => entry.id));

  for (const [index, echo] of echoes.entries()) {
    if (![1, 3, 4].includes(echo.cost)) fail(`echoes[${index}].cost must be 1, 3, or 4`);
    const refs = array(echo.sonataSetIds, `echoes[${index}].sonataSetIds`, 100);
    if (new Set(refs).size !== refs.length) fail(`echoes[${index}] duplicates Sonata references`);
    for (const [refIndex, ref] of refs.entries()) {
      const id = safeCanonicalId(ref, `echoes[${index}].sonataSetIds[${refIndex}]`);
      if (!sonataIds.has(id)) fail(`echoes[${index}] references unknown Sonata ${id}`);
    }
  }

  return {
    characters: counts.characters,
    weapons: counts.weapons,
    echoes: counts.echoes,
    sonataSets: counts.sonataSets,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.length === 0 ? "--generated" : args[0];
  if (args.length > 1 || !MODES.has(mode)) fail("only --generated, --artifact, or --public fixed-path modes are accepted");
  const filePath = MODES.get(mode);
  await assertNoSymlinkComponents(filePath);
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) fail("input must be a regular file");
  if (stats.size <= 0 || stats.size > MAX_BYTES) fail(`input size ${stats.size} is outside 1..${MAX_BYTES}`);
  const bytes = await readFile(filePath);
  let database;
  try {
    database = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("input is not valid UTF-8 JSON");
  }
  const nodes = validateTree(database);
  const counts = validateDatabase(database);
  const report = Object.freeze({
    mode,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    nodes,
    counts,
  });
  console.log(`WUWA_GENERATED_GAME_DATABASE_VERIFY=${JSON.stringify(report)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
