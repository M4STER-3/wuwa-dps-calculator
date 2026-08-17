import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeGameDatabaseReadiness } from "./lib/game-database-readiness.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI = path.join(REPO_ROOT, "scripts", "analyze-wuwa-game-data-readiness.mjs");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function safeSnapshot() {
  return {
    schemaVersion: 1,
    sourceProvider: "encore",
    language: "en",
    dataset: "Release",
    sourceImportedAt: "2026-08-17T00:00:00.000Z",
    counts: { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 },
    sourceHashes: {
      characters: { "1001": HASH_A },
      weapons: { "2001": HASH_B },
      echoes: { "3001": HASH_C },
    },
    characters: [
      {
        sourceId: "1001",
        name: "Fixture Resonator",
        element: "Spectro",
        weaponType: "Sword",
        rarity: 5,
        properties: [
          { name: "HP", baseValue: 100, sourceGrowthValues: [{ sourceLevelIndex: 1, value: "100" }] },
        ],
        skills: [
          {
            sourceSkillId: "skill-1",
            type: "Inherent Skill",
            description: "A real source entry whose display name is absent.",
            attributes: [],
          },
          {
            sourceSkillId: "skill-2",
            name: "Named Skill",
            type: "Resonance Skill",
            description: "Plain text only.",
            attributes: [],
          },
        ],
        resonanceChain: [1, 2, 3, 4, 5, 6].map((sequence) => ({
          sequence,
          sourceNodeId: `node-${sequence}`,
          name: `Sequence ${sequence}`,
          description: "Plain sequence text.",
        })),
        permanentPropertyNodes: [],
      },
    ],
    weapons: [
      {
        sourceId: "2001",
        name: "Fixture Sword",
        weaponType: "Sword",
        rarity: 5,
        properties: [
          {
            name: "ATK",
            baseValue: 50,
            sourceGrowthValues: [
              { sourceLevelIndex: 20.5, value: "100" },
              { sourceLevelIndex: 21, value: "101" },
            ],
          },
        ],
        breaches: [],
      },
    ],
    echoes: [
      {
        sourceId: "3001",
        name: "Fixture Echo",
        qualityId: 5,
        sourceRarity: 4,
        levelUpGroupId: 1,
        sourceSonataGroupIds: [9001],
      },
    ],
    sonataSets: [
      {
        name: "Fixture Sonata",
        bonuses: [
          { pieces: 2, description: "Fixture bonus." },
          { pieces: 5, description: "Fixture second bonus." },
        ],
      },
    ],
    diagnostics: [],
  };
}

async function expectThrow(label, fn, pattern) {
  let thrown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `${label}: expected rejection`);
  if (pattern) assert.match(String(thrown.message ?? thrown), pattern, label);
}

async function runNode(args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function testSafeReadinessReport() {
  const report = analyzeGameDatabaseReadiness(safeSnapshot());
  assert.equal(report.source.counts.characters, 1);
  assert.equal(report.readiness.characters.sourceIdentityReady, 1);
  assert.equal(report.readiness.characters.completeNamedSkillCatalogReady, 0);
  assert.equal(report.readiness.characters.statProgressionReady, 0);
  assert.equal(report.readiness.weapons.sourceIdentityReady, 1);
  assert.equal(report.readiness.weapons.statProgressionReady, 0);
  assert.equal(report.readiness.echoes.sourceIdentityReady, 1);
  assert.equal(report.readiness.echoes.costResolved, 0);
  assert.equal(report.readiness.echoes.canonicalCatalogReady, 0);
  assert.equal(report.readiness.sonataSets.definitionReady, 1);
  assert.equal(report.readiness.sonataSets.stableIdentityReady, 0);
  assert.equal(report.observed.unnamedCharacterSkills, 1);
  assert.equal(report.observed.weaponFractionalGrowthPoints, 1);
  const codes = new Set(report.blockers.map((entry) => entry.code));
  for (const code of [
    "character-growth-level-map-unresolved",
    "character-skill-name-missing",
    "weapon-growth-level-map-unresolved",
    "echo-cost-unresolved",
    "sonata-stable-source-id-unresolved",
    "echo-sonata-reference-map-unresolved",
  ]) {
    assert.ok(codes.has(code), `missing blocker ${code}`);
  }
}

async function testMalformedInputsFailClosed() {
  const wrongProvider = clone(safeSnapshot());
  wrongProvider.sourceProvider = "other";
  await expectThrow("wrong provider", () => analyzeGameDatabaseReadiness(wrongProvider), /sourceProvider must be encore/);

  const duplicate = clone(safeSnapshot());
  duplicate.characters.push(clone(duplicate.characters[0]));
  duplicate.counts.characters = 2;
  await expectThrow("duplicate source ID", () => analyzeGameDatabaseReadiness(duplicate), /duplicates source ID/);

  const missingHash = clone(safeSnapshot());
  delete missingHash.sourceHashes.characters["1001"];
  await expectThrow("missing source hash", () => analyzeGameDatabaseReadiness(missingHash), /count does not match|missing source ID/);

  const unreviewedFraction = clone(safeSnapshot());
  unreviewedFraction.weapons[0].properties[0].sourceGrowthValues[0].sourceLevelIndex = 21.25;
  await expectThrow("unreviewed fraction", () => analyzeGameDatabaseReadiness(unreviewedFraction), /unreviewed fractional source index/);

  const dangerous = JSON.parse(JSON.stringify(safeSnapshot()).replace(
    '"schemaVersion":1',
    '"__proto__":{"polluted":true},"schemaVersion":1',
  ));
  await expectThrow("dangerous object key", () => analyzeGameDatabaseReadiness(dangerous), /forbidden object key __proto__/);
}

async function testFixedPathCliAndSymlinkGuard() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "wuwa-readiness-"));
  try {
    const inputRoot = path.join(cwd, ".tmp", "wuwa-game-data-normalized");
    await mkdir(inputRoot, { recursive: true });
    const inputPath = path.join(inputRoot, "normalized-source.json");
    await writeFile(inputPath, `${JSON.stringify(safeSnapshot())}\n`, "utf8");

    const result = await runNode([CLI], cwd);
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WUWA_GAME_DATABASE_READINESS=/);
    const report = JSON.parse(
      await readFile(path.join(cwd, ".tmp", "wuwa-game-data-readiness", "readiness.json"), "utf8"),
    );
    assert.equal(report.readiness.echoes.canonicalCatalogReady, 0);

    const argResult = await runNode([CLI, "--input=elsewhere"], cwd);
    assert.equal(argResult.code, 1);
    assert.match(argResult.stderr, /does not accept paths, URLs, or other arguments/);

    if (process.platform !== "win32") {
      await rm(inputPath);
      const target = path.join(cwd, "source.json");
      await writeFile(target, `${JSON.stringify(safeSnapshot())}\n`, "utf8");
      await symlink(target, inputPath, "file");
      const symlinkResult = await runNode([CLI], cwd);
      assert.equal(symlinkResult.code, 1);
      assert.match(symlinkResult.stderr, /symbolic links are forbidden/);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function main() {
  testSafeReadinessReport();
  await testMalformedInputsFailClosed();
  await testFixedPathCliAndSymlinkGuard();
  console.log("GameDatabase readiness security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
