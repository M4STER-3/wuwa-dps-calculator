import { lstat, mkdir, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(process.cwd());
const PUBLIC_ROOT = path.join(REPO_ROOT, "public");
const OUTPUT_ROOT = path.join(PUBLIC_ROOT, "assets", "wuwa");
const OBJECTS_ROOT = path.join(OUTPUT_ROOT, "objects");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const SYNC_SCRIPT = fileURLToPath(new URL("./sync-wuwa-assets.mjs", import.meta.url));
const ALLOWED_ARGS = new Set(["--dry-run", "--force"]);

function assertAllowedArguments(args) {
  for (const arg of args) {
    if (!ALLOWED_ARGS.has(arg)) {
      throw new Error(`Unsupported asset-sync argument: ${arg}`);
    }
  }
}

async function assertRegularFile(filePath, label) {
  const stats = await lstat(filePath);
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
}

async function assertRegularFileIfPresent(filePath, label) {
  try {
    await assertRegularFile(filePath, label);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function assertNoSymlinkComponents(targetPath, trustedRoot) {
  const root = path.resolve(trustedRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped trusted root: ${target}`);
  }

  const segments = relative ? relative.split(path.sep) : [];
  let current = root;

  await assertRegularDirectoryIfPresent(current);
  for (const segment of segments) {
    current = path.join(current, segment);
    await assertRegularDirectoryIfPresent(current);
  }
}

async function assertRegularDirectoryIfPresent(directoryPath) {
  try {
    const stats = await lstat(directoryPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Symbolic links are forbidden in asset output paths: ${directoryPath}`);
    }
    if (!stats.isDirectory()) {
      throw new Error(`Expected a directory in asset output path: ${directoryPath}`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function assertObjectStoreEntriesSafe() {
  const entries = await readdir(OBJECTS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are forbidden in the asset object store: ${entry.name}`);
    }
    if (!entry.isFile()) {
      throw new Error(`Unexpected non-file entry in the asset object store: ${entry.name}`);
    }
  }
}

async function prepareSafeOutputTree() {
  await assertRegularFile(SYNC_SCRIPT, "Asset synchronizer");
  await assertNoSymlinkComponents(PUBLIC_ROOT, REPO_ROOT);
  await mkdir(OBJECTS_ROOT, { recursive: true, mode: 0o755 });
  await assertNoSymlinkComponents(OBJECTS_ROOT, REPO_ROOT);
  await assertRegularFileIfPresent(MANIFEST_PATH, "Asset manifest");
  await assertObjectStoreEntriesSafe();

  const realRepo = await realpath(REPO_ROOT);
  const realOutput = await realpath(OUTPUT_ROOT);
  const relative = path.relative(realRepo, realOutput);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Asset output directory escaped the repository root");
  }
}

async function main() {
  const args = process.argv.slice(2);
  assertAllowedArguments(args);
  await prepareSafeOutputTree();

  const child = spawn(process.execPath, [SYNC_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Asset synchronizer terminated by signal ${signal}`));
      else resolve(code ?? 1);
    });
  });

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
