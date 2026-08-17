import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateGameDatabaseV1 } from "./lib/game-database-generator.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI = path.join(REPO_ROOT, "scripts", "generate-wuwa-game-database-v1.mjs");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

function safeSnapshot() {
  return {
    schemaVersion: 1,
    sourceProvider: "encore",
    language: "en",
    dataset: "Release",
    sourceImportedAt: "2026-08-17T00:00:00.000Z",
    counts: { characters: 1, weapons: 1, echoes: 3, sonataSets: 1 },
    sourceHashes: {
      characters: { "1001": HASH_A },
      weapons: { "2001": HASH_B },
      echoes: { "3001": HASH_C, "3002": HASH_D, "3003": HASH_E },
    },
    characters: [
      {
        sourceId: "1001",
        name: "Fixture Resonator",
        element: "Spectro",
        weaponType: "Sword",
        rarity: 5,
        maxLevel: 90,
        properties: [],
        skills: [
          {
            sourceSkillId: "skill-1",
            name: "Fixture Skill",
            type: "Resonance Skill",
            description: "Deal fixture damage.",
            attributes: [{ sourceAttributeId: "attr-1", name: "Multiplier", values: ["100%"] }],
          },
          {
            sourceSkillId: "skill-2",
            type: "Inherent Skill",
            description: "Source text without a display name.",
            attributes: [],
          },
        ],
        resonanceChain: [1, 2, 3, 4, 5, 6].map((sequence) => ({
          sequence,
          sourceNodeId: `node-${sequence}`,
          name: `Sequence ${sequence}`,
          description: `Sequence ${sequence} description.`,
        })),
        permanentPropertyNodes: [{ sourceNodeId: "passive-1", title: "Passive", description: "Passive source text." }],
      },
    ],
    weapons: [
      {
        sourceId: "2001",
        name: "Fixture Sword",
        weaponType: "Sword",
        rarity: 5,
        properties: [],
        passive: {
          name: "Fixture Passive",
          descriptionTemplate: "Increase ATK by a source value.",
          rankParameterSets: [
            { values: ["1"] },
            { values: ["2"] },
            { values: ["3"] },
            { values: ["4"] },
            { values: ["5"] },
          ],
        },
        breaches: [],
      },
    ],
    echoes: [
      {
        sourceId: "3001",
        sourceItemId: "60000015",
        name: "Fixture Echo",
        qualityId: 5,
        sourceRarity: 0,
        levelUpGroupId: 4,
        sourceSonataGroupIds: [9001],
        sourcePhantomType: 1,
        sourceMainPropRandGroupId: 503,
        catalogState: "base",
        cost: 1,
        skill: {
          sourceSkillId: "echo-skill-1",
          summary: "Fixture summary.",
          description: "Fixture Echo skill description.",
          cooldownSeconds: 15,
        },
      },
      {
        sourceId: "3002",
        sourceItemId: "60100015",
        name: "Phantom: Fixture Echo",
        qualityId: 5,
        sourceRarity: 0,
        levelUpGroupId: 4,
        sourceSonataGroupIds: [9001],
        sourcePhantomType: 1,
        sourceMainPropRandGroupId: 203,
        catalogState: "phantom-skin",
      },
      {
        sourceId: "3003",
        sourceItemId: "60200012",
        name: "Fixture Noncanonical Row",
        qualityId: 2,
        sourceRarity: 1,
        levelUpGroupId: 4,
        sourceSonataGroupIds: [9001],
        sourcePhantomType: 2,
        sourceMainPropRandGroupId: 202,
        catalogState: "noncanonical",
      },
    ],
    sonataSets: [
      {
        sourceId: "9001",
        name: "Fixture Sonata",
        bonuses: [
          { pieces: 2, description: "Two-piece fixture bonus." },
          { pieces: 5, description: "Five-piece fixture bonus." },
        ],
      },
    ],
    diagnostics: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function testSafeGeneration() {
  const { database, report } = generateGameDatabaseV1(safeSnapshot());
  assert.deepEqual(database.manifest.counts, { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 });
  assert.equal(database.manifest.schemaVersion, 1);
  assert.equal(database.manifest.dataset, "Release");
  assert.equal(database.manifest.sourceProvider, "encore");
  assert.equal(database.characters[0].kind, "character");
  assert.deepEqual(database.characters[0].externalIds, { encore: "1001", wuwa: "1001" });
  assert.equal(database.characters[0].skills.length, 1);
  assert.equal(database.characters[0].skills[0].sourceParameters.sourceSkillId, "skill-1");
  assert.equal(database.characters[0].maxLevel, undefined);
  assert.equal(database.characters[0].passiveNodes, undefined);
  assert.equal(database.characters[0].sequences[0].id, undefined);
  assert.equal(database.weapons[0].kind, "weapon");
  assert.deepEqual(database.weapons[0].baseStats, {});
  assert.equal(database.weapons[0].passive.ranks.length, 0);
  assert.equal(database.echoes[0].kind, "echo");
  assert.equal(database.echoes[0].cost, 1);
  assert.equal(database.echoes[0].echoSkill.description, "Fixture Echo skill description.");
  assert.deepEqual(database.echoes[0].sonataSetIds, ["sonata-set:9001"]);
  assert.equal(database.sonataSets[0].kind, "sonata-set");
  assert.equal(database.sonataSets[0].id, "sonata-set:9001");
  assert.equal(report.skippedUnnamedCharacterSkills, 1);
  assert.equal(report.omittedPermanentCharacterNodes, 1);
  assert.equal(report.skippedPhantomSkinRows, 1);
  assert.equal(report.skippedNoncanonicalEchoRows, 1);
  assert.equal(report.weaponPassiveRankSetsNotRendered, 5);
}

async function testHostileGeneration() {
  const missingState = clone(safeSnapshot());
  delete missingState.echoes[0].catalogState;
  await expectThrow("missing Echo state", () => generateGameDatabaseV1(missingState), /missing a reviewed catalogState/);

  const unknownSonata = clone(safeSnapshot());
  unknownSonata.echoes[0].sourceSonataGroupIds = [9999];
  await expectThrow("unknown Sonata", () => generateGameDatabaseV1(unknownSonata), /references unknown Sonata/);

  const missingHash = clone(safeSnapshot());
  delete missingHash.sourceHashes.echoes["3003"];
  await expectThrow("missing source hash", () => generateGameDatabaseV1(missingHash), /hash count does not match|missing source ID/);

  const scriptText = clone(safeSnapshot());
  scriptText.characters[0].skills[0].description = "<script>alert(1)</script>";
  await expectThrow("script text", () => generateGameDatabaseV1(scriptText), /script-like content/);

  const urlText = clone(safeSnapshot());
  urlText.sonataSets[0].bonuses[0].description = "https://attacker.invalid/";
  await expectThrow("URL text", () => generateGameDatabaseV1(urlText), /unexpected URL/);
}

async function testFixedPathCli() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "wuwa-generator-"));
  try {
    const inputRoot = path.join(cwd, ".tmp", "wuwa-game-data-normalized");
    await mkdir(inputRoot, { recursive: true });
    const inputPath = path.join(inputRoot, "normalized-source.json");
    await writeFile(inputPath, `${JSON.stringify(safeSnapshot())}\n`, "utf8");

    const result = await runNode([CLI], cwd);
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WUWA_GAME_DATABASE_V1_GENERATION=/);
    const database = JSON.parse(
      await readFile(path.join(cwd, ".tmp", "wuwa-game-database-v1", "game-database-v1.json"), "utf8"),
    );
    assert.equal(database.manifest.counts.echoes, 1);
    const report = JSON.parse(
      await readFile(path.join(cwd, ".tmp", "wuwa-game-database-v1", "generation-report.json"), "utf8"),
    );
    assert.equal(report.skippedPhantomSkinRows, 1);

    const argResult = await runNode([CLI, "--input=elsewhere"], cwd);
    assert.equal(argResult.code, 1);
    assert.match(argResult.stderr, /does not accept paths, URLs, or other arguments/);

    if (process.platform !== "win32") {
      await rm(inputPath);
      const target = path.join(cwd, "outside-source.json");
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
  testSafeGeneration();
  await testHostileGeneration();
  await testFixedPathCli();
  console.log("GameDatabase generator security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
