import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const IMPORTER = path.join(REPO_ROOT, "scripts", "import-wuwa-game-data.mjs");
const NORMALIZER = path.join(REPO_ROOT, "scripts", "normalize-wuwa-game-data.mjs");
const MOCK_FETCH = path.join(REPO_ROOT, "scripts", "test-fixtures", "mock-encore-data-fetch.mjs");

async function runNode(args, { cwd, env = {} } = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "wuwa-normalizer-security-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function importerArgs() {
  return ["--import", pathToFileURL(MOCK_FETCH).href, IMPORTER];
}

async function importFixture(cwd, testCase) {
  const result = await runNode(importerArgs(), {
    cwd,
    env: { MOCK_ENCORE_DATA_CASE: testCase },
  });
  assert.equal(result.signal, null);
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
}

async function loadNormalized(cwd) {
  return JSON.parse(
    await readFile(path.join(cwd, ".tmp", "wuwa-game-data-normalized", "normalized-source.json"), "utf8"),
  );
}

async function testSafeNormalization() {
  await withTempDirectory(async (cwd) => {
    await importFixture(cwd, "safe");
    const first = await runNode([NORMALIZER], { cwd });
    assert.equal(first.code, 0, `${first.stdout}\n${first.stderr}`);
    assert.match(first.stdout, /WUWA_GAME_DATA_NORMALIZE_REPORT=/);

    const normalized = await loadNormalized(cwd);
    assert.equal(normalized.schemaVersion, 1);
    assert.deepEqual(normalized.counts, { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 });

    const character = normalized.characters[0];
    assert.equal(character.sourceId, "1");
    assert.equal(character.name, "Security Fixture Character");
    assert.equal(character.element, "Fusion");
    assert.equal(character.weaponType, "Sword");
    assert.equal(character.rarity, 5);
    assert.equal(character.skills[0].description, "Deal Fusion DMG to the target.");
    assert.equal(character.skills[0].attributes[0].values[0], "100%");
    assert.equal(character.resonanceChain.length, 6);
    assert.equal(character.resonanceChain[0].description, "Sequence 1 description.");
    assert.equal(character.properties[0].sourceGrowthValues[0].sourceLevelIndex, 1);

    const weapon = normalized.weapons[0];
    assert.equal(weapon.name, "Security Fixture Weapon");
    assert.equal(weapon.weaponType, "Sword");
    assert.equal(weapon.passive.name, "Fixture Passive");
    assert.equal(weapon.passive.descriptionTemplate, "Increase ATK by {0} after a reviewed condition.");
    assert.deepEqual(weapon.passive.rankParameterSets.map((set) => set[0]), ["10%", "12.5%", "15%", "17.5%", "20%"]);
    assert.equal(weapon.breaches.at(-1).levelLimit, 90);

    const echo = normalized.echoes[0];
    assert.equal(echo.name, "Security Fixture Echo");
    assert.equal(echo.sourceIntensity, "Overlord Class");
    assert.equal(echo.skill.description, "Transform and deal Fusion DMG.");
    assert.equal("cost" in echo, false, "unverified Echo cost must not be guessed into normalized output");

    const sonata = normalized.sonataSets[0];
    assert.equal(sonata.name, "Molten Rift");
    assert.deepEqual(sonata.bonuses.map((bonus) => bonus.pieces), [2, 5]);
    assert.equal(sonata.bonuses[1].description, "Fusion DMG + 30% for 15s after releasing Resonance Skill.");

    const serialized = JSON.stringify(normalized);
    assert.equal(serialized.includes("evil.example"), false, "unknown remote URLs must not propagate into normalized data");
    assert.equal(serialized.includes("<script"), false, "script-like source text must not propagate");
    assert.equal(serialized.includes("<color"), false, "source rich-text tags must be converted to inert plain text");
    assert.equal(serialized.includes("Advertisement"), false, "unknown source fields must not propagate");
    assert.ok(normalized.diagnostics.some((entry) => entry.code === "echo-cost-unresolved"));
    assert.ok(normalized.diagnostics.some((entry) => entry.code === "source-growth-index-not-game-level"));

    const before = await readFile(
      path.join(cwd, ".tmp", "wuwa-game-data-normalized", "normalized-source.json"),
      "utf8",
    );
    const second = await runNode([NORMALIZER], { cwd });
    assert.equal(second.code, 0, `${second.stdout}\n${second.stderr}`);
    const after = await readFile(
      path.join(cwd, ".tmp", "wuwa-game-data-normalized", "normalized-source.json"),
      "utf8",
    );
    assert.equal(after, before, "normalization must be deterministic for the same RAW snapshot");
  });
}

async function testAllowlistedScriptLikeTextFailsClosed() {
  await withTempDirectory(async (cwd) => {
    await importFixture(cwd, "unsafe-normalizer-text");
    const result = await runNode([NORMALIZER], { cwd });
    assert.equal(result.code, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /script-like markup/i);
  });
}

async function testAllowlistedRemoteUrlFailsClosed() {
  await withTempDirectory(async (cwd) => {
    await importFixture(cwd, "normalizer-url-text");
    const result = await runNode([NORMALIZER], { cwd });
    assert.equal(result.code, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /unexpected URL/i);
  });
}

async function testNormalizerRejectsArguments() {
  await withTempDirectory(async (cwd) => {
    const result = await runNode([NORMALIZER, "--input=/tmp/evil"], { cwd });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /does not accept filesystem or network arguments/i);
  });
}

async function testRawSymlinkRejected() {
  if (process.platform === "win32") return;
  await withTempDirectory(async (cwd) => {
    await importFixture(cwd, "safe");
    const detailRoot = path.join(cwd, "data", "sources", "encore", "release", "characters", "details");
    const manifest = JSON.parse(
      await readFile(path.join(cwd, "data", "sources", "encore", "release", "manifest.json"), "utf8"),
    );
    const detailPath = path.join(detailRoot, manifest.resources.characters.entities[0].detailFile);
    await rm(detailPath);
    await symlink("/etc/hosts", detailPath, "file");

    const result = await runNode([NORMALIZER], { cwd });
    assert.equal(result.code, 1);
    assert.match(`${result.stdout}\n${result.stderr}`, /symbolic link forbidden/i);
  });
}

async function main() {
  await testSafeNormalization();
  await testAllowlistedScriptLikeTextFailsClosed();
  await testAllowlistedRemoteUrlFailsClosed();
  await testNormalizerRejectsArguments();
  await testRawSymlinkRejected();
  console.log("Encore game-data normalizer security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
