import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { generateGameDatabaseV1 } from "./lib/game-database-generator.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const INPUT_PATH = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-normalized", "normalized-source.json");
const OUTPUT_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-database-v1");
const DATABASE_PATH = path.join(OUTPUT_ROOT, "game-database-v1.json");
const REPORT_PATH = path.join(OUTPUT_ROOT, "generation-report.json");
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_DATABASE_BYTES = 32 * 1024 * 1024;
const MAX_REPORT_BYTES = 1024 * 1024;
const MAX_JSON_NODES = 500_000;
const MAX_JSON_DEPTH = 32;
const MAX_ARRAY_LENGTH = 50_000;
const MAX_OBJECT_KEYS = 20_000;
const MAX_STRING_LENGTH = 2 * 1024 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function fail(message) {
  throw new Error(`GameDatabase V1 generation: ${message}`);
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
    if (stats?.isSymbolicLink()) fail(`symbolic links are forbidden in generator paths: ${current}`);
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

async function readInput() {
  await assertNoSymlinkComponents(INPUT_PATH, REPO_ROOT);
  const stats = await lstat(INPUT_PATH);
  if (stats.isSymbolicLink() || !stats.isFile()) fail("normalized input must be a regular file");
  if (stats.size <= 0 || stats.size > MAX_INPUT_BYTES) fail(`normalized input size ${stats.size} is outside reviewed limit`);
  const bytes = await readFile(INPUT_PATH);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("normalized input is not valid UTF-8 JSON");
  }
  validateTree(parsed, "normalized input");
  return parsed;
}

async function writeAtomic(filePath, value, maxBytes, label) {
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o755 });
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  const serialized = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (serialized.length <= 0 || serialized.length > maxBytes) fail(`${label} size ${serialized.length} is outside reviewed limit`);
  const temporaryPath = path.join(OUTPUT_ROOT, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serialized, { flag: "wx", mode: 0o644 });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return serialized.length;
}

async function main() {
  assertNoArguments();
  const snapshot = await readInput();
  const { database, report } = generateGameDatabaseV1(snapshot);
  const databaseBytes = await writeAtomic(DATABASE_PATH, database, MAX_DATABASE_BYTES, "GameDatabase output");
  const reportBytes = await writeAtomic(REPORT_PATH, report, MAX_REPORT_BYTES, "generation report");
  console.log(`WUWA_GAME_DATABASE_V1_GENERATION=${JSON.stringify({
    databaseBytes,
    reportBytes,
    counts: database.manifest.counts,
    skippedPhantomSkinRows: report.skippedPhantomSkinRows,
    skippedNoncanonicalEchoRows: report.skippedNoncanonicalEchoRows,
    unresolved: report.unresolved,
  })}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
