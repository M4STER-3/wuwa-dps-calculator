import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SYNC_SCRIPT = path.join(REPO_ROOT, "scripts", "sync-wuwa-assets.mjs");
const SAFE_WRAPPER = path.join(REPO_ROOT, "scripts", "run-safe-wuwa-assets.mjs");
const MOCK_FETCH = path.join(REPO_ROOT, "scripts", "test-fixtures", "mock-encore-fetch.mjs");

async function runNode(args, { cwd, env = {} } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: cwd ?? REPO_ROOT,
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function withTempDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wuwa-assets-security-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mockedSyncArgs(extra = []) {
  return ["--import", pathToFileURL(MOCK_FETCH).href, SYNC_SCRIPT, ...extra];
}

async function testSafeSync() {
  await withTempDirectory(async (cwd) => {
    const result = await runNode(mockedSyncArgs(), {
      cwd,
      env: { MOCK_ENCORE_CASE: "safe" },
    });
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);

    const manifestPath = path.join(cwd, "public", "assets", "wuwa", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.gameVersion, "Release");
    assert.equal(manifest.security.maxImageBytes, 8 * 1024 * 1024);
    assert.equal(manifest.security.maxRemoteBytesPerRun, 1024 * 1024 * 1024);
    assert.equal(manifest.security.maxAssetsPerRun, 10_000);

    const characterAssets = manifest.entities.characters["1"].assets;
    assert.ok(characterAssets["list-roleheadicon"]);
    assert.ok(characterAssets["detail-roleportrait"]);
    assert.ok(manifest.entities.weapons["2"].assets["list-icon"]);
    assert.ok(manifest.entities.echoes["3"].assets["list-icon"]);

    const logicalPaths = [];
    for (const category of Object.values(manifest.entities)) {
      for (const entity of Object.values(category)) {
        for (const asset of Object.values(entity.assets)) logicalPaths.push(asset.path);
      }
    }
    assert.equal(new Set(logicalPaths).size, 1, "identical image bytes should be content-deduplicated");

    const objectFiles = await readdir(path.join(cwd, "public", "assets", "wuwa", "objects"));
    assert.equal(objectFiles.length, 1);
    assert.match(objectFiles[0], /^[a-f0-9]{64}\.png$/);
  });
}

async function testDangerousSourceId() {
  await withTempDirectory(async (cwd) => {
    const result = await runNode(mockedSyncArgs(["--dry-run"]), {
      cwd,
      env: { MOCK_ENCORE_CASE: "dangerous-id" },
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /forbidden object key/i);
    assert.equal(await exists(path.join(cwd, "public", "assets", "wuwa", "manifest.json")), false);
  });
}

async function testBadImagePreservesManifestAuthority() {
  await withTempDirectory(async (cwd) => {
    const result = await runNode(mockedSyncArgs(), {
      cwd,
      env: { MOCK_ENCORE_CASE: "bad-image" },
    });
    assert.equal(result.code, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /signature does not match|failed/i);
    assert.equal(await exists(path.join(cwd, "public", "assets", "wuwa", "manifest.json")), false);
  });
}

async function testUnknownArgumentFailsBeforeNetwork() {
  await withTempDirectory(async (cwd) => {
    const result = await runNode([SAFE_WRAPPER, "--not-allowed"], { cwd });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /unsupported asset-sync argument/i);
  });
}

async function testSymlinkGuards() {
  if (process.platform === "win32") return;

  await withTempDirectory(async (cwd) => {
    await symlink(os.tmpdir(), path.join(cwd, "public"), "dir");
    const result = await runNode([SAFE_WRAPPER, "--dry-run"], { cwd });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /symbolic links are forbidden/i);
  });

  await withTempDirectory(async (cwd) => {
    const root = path.join(cwd, "public", "assets", "wuwa");
    await mkdir(path.join(root, "objects"), { recursive: true });
    await symlink("/etc/hosts", path.join(root, "manifest.json"), "file");
    const result = await runNode([SAFE_WRAPPER, "--dry-run"], { cwd });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /manifest must not be a symbolic link/i);
  });

  await withTempDirectory(async (cwd) => {
    const objects = path.join(cwd, "public", "assets", "wuwa", "objects");
    await mkdir(objects, { recursive: true });
    await symlink("/etc/hosts", path.join(objects, "host-link"), "file");
    const result = await runNode([SAFE_WRAPPER, "--dry-run"], { cwd });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /symbolic links are forbidden in the asset object store/i);
  });
}

async function main() {
  await testSafeSync();
  await testDangerousSourceId();
  await testBadImagePreservesManifestAuthority();
  await testUnknownArgumentFailsBeforeNetwork();
  await testSymlinkGuards();
  console.log("Asset synchronization security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
