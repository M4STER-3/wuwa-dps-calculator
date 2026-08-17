import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { analyzeReviewedGameDatabaseReadiness } from "./lib/reviewed-game-database-readiness.mjs";

const REPO_ROOT = path.resolve(process.cwd());
const INPUT_PATH = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-normalized", "normalized-source.json");
const OUTPUT_ROOT = path.join(REPO_ROOT, ".tmp", "wuwa-game-data-readiness");
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "readiness.json");
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function fail(message) {
  throw new Error(`GameDatabase readiness: ${message}`);
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
    if (stats?.isSymbolicLink()) fail(`symbolic links are forbidden in readiness paths: ${current}`);
  }
}

async function readNormalizedInput() {
  await assertNoSymlinkComponents(INPUT_PATH, REPO_ROOT);
  const stats = await lstat(INPUT_PATH);
  if (stats.isSymbolicLink() || !stats.isFile()) fail("normalized input must be a regular file");
  if (stats.size <= 0 || stats.size > MAX_INPUT_BYTES) fail(`normalized input size ${stats.size} is outside the reviewed limit`);
  const raw = await readFile(INPUT_PATH);
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    fail("normalized input is not valid UTF-8 JSON");
  }
  return parsed;
}

async function writeReportAtomic(report) {
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o755 });
  await assertNoSymlinkComponents(OUTPUT_ROOT, REPO_ROOT);
  const serialized = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (serialized.length <= 0 || serialized.length > MAX_OUTPUT_BYTES) fail("readiness report exceeds output size limit");
  const temporaryPath = path.join(OUTPUT_ROOT, `.readiness.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, serialized, { flag: "wx", mode: 0o644 });
    await rename(temporaryPath, OUTPUT_PATH);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function main() {
  assertNoArguments();
  const snapshot = await readNormalizedInput();
  const report = analyzeReviewedGameDatabaseReadiness(snapshot);
  await writeReportAtomic(report);
  console.log(`WUWA_GAME_DATABASE_READINESS=${JSON.stringify({
    characters: report.readiness.characters,
    weapons: report.readiness.weapons,
    echoes: report.readiness.echoes,
    sonataSets: report.readiness.sonataSets,
    blockerCodes: report.blockers.map((entry) => entry.code),
    reviewedMappings: report.reviewedMappings,
  })}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
