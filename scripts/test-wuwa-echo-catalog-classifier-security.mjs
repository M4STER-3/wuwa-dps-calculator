import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyNormalizedEchoCatalog } from "./lib/echo-catalog-classifier.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI = path.join(REPO_ROOT, "scripts", "classify-wuwa-echo-catalog.mjs");
const HASH = (value) => createHash("sha256").update(value).digest("hex");

function fixture() {
  const echoes = [
    {
      sourceId: "3001",
      name: "Fixture Base Echo",
      qualityId: 5,
      sourceRarity: 0,
      levelUpGroupId: 4,
      sourceSonataGroupIds: [1],
      skill: { sourceSkillId: "7001", description: "Base skill.", cooldownSeconds: 15 },
    },
    {
      sourceId: "3002",
      name: "Phantom: Fixture Base Echo",
      qualityId: 5,
      sourceRarity: 0,
      levelUpGroupId: 4,
      sourceSonataGroupIds: [1],
    },
    {
      sourceId: "3003",
      name: "Fixture Event Row",
      qualityId: 2,
      sourceRarity: 1,
      levelUpGroupId: 4,
      sourceSonataGroupIds: [1],
    },
  ];
  const echoDetails = [
    {
      sourceId: "3001",
      detail: {
        MonsterId: 3001,
        ItemId: 60000015,
        QualityId: 5,
        Rarity: 0,
        LevelUpGroupId: 4,
        PhantomType: 1,
        MainProp: { RandGroupId: 503 },
        FetterGroup: [1],
      },
    },
    {
      sourceId: "3002",
      detail: {
        MonsterId: 3002,
        ItemId: 60100015,
        QualityId: 5,
        Rarity: 0,
        LevelUpGroupId: 4,
        PhantomType: 1,
        MainProp: { RandGroupId: 203 },
        FetterGroup: [1],
      },
    },
    {
      sourceId: "3003",
      detail: {
        MonsterId: 3003,
        ItemId: 60200012,
        QualityId: 2,
        Rarity: 1,
        LevelUpGroupId: 4,
        PhantomType: 2,
        MainProp: { RandGroupId: 202 },
        FetterGroup: [1],
      },
    },
  ];
  return {
    snapshot: {
      schemaVersion: 1,
      sourceProvider: "encore",
      language: "en",
      dataset: "Release",
      sourceImportedAt: "2026-08-17T00:00:00.000Z",
      counts: { characters: 0, weapons: 0, echoes: 3, sonataSets: 0 },
      characters: [],
      weapons: [],
      echoes,
      sonataSets: [],
      sourceHashes: { characters: {}, weapons: {}, echoes: {} },
      diagnostics: [{ code: "echo-cost-unresolved", severity: "warning", message: "old blocker" }],
    },
    echoDetails,
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

function testPureClassifier() {
  const { snapshot, echoDetails } = fixture();
  const result = classifyNormalizedEchoCatalog(snapshot, echoDetails);
  assert.equal(result.echoes[0].catalogState, "base");
  assert.equal(result.echoes[0].cost, 1);
  assert.equal(result.echoes[0].sourceItemId, "60000015");
  assert.equal(result.echoes[0].sourceMainPropRandGroupId, 503);
  assert.equal(result.echoes[1].catalogState, "phantom-skin");
  assert.equal(result.echoes[1].cost, undefined);
  assert.equal(result.echoes[2].catalogState, "noncanonical");
  assert.equal(result.echoes[2].cost, undefined);
  const codes = result.diagnostics.map((entry) => entry.code);
  assert.ok(!codes.includes("echo-cost-unresolved"));
  assert.ok(codes.includes("echo-canonical-catalog-reviewed"));
}

async function testHostileInputs() {
  const unknownGroup = fixture();
  unknownGroup.echoDetails[0].detail.MainProp.RandGroupId = 599;
  await expectThrow("unreviewed base RandGroup", () => classifyNormalizedEchoCatalog(unknownGroup.snapshot, unknownGroup.echoDetails), /unreviewed MainProp\.RandGroupId/);

  const rarityMismatch = fixture();
  rarityMismatch.echoDetails[0].detail.Rarity = 1;
  rarityMismatch.snapshot.echoes[0].sourceRarity = 1;
  await expectThrow("rarity mismatch", () => classifyNormalizedEchoCatalog(rarityMismatch.snapshot, rarityMismatch.echoDetails), /contradicts reviewed/);

  const qualityMismatch = fixture();
  qualityMismatch.echoDetails[0].detail.QualityId = 4;
  await expectThrow("quality mismatch", () => classifyNormalizedEchoCatalog(qualityMismatch.snapshot, qualityMismatch.echoDetails), /QualityId does not match/);

  const duplicateItem = fixture();
  duplicateItem.echoDetails[1].detail.MonsterId = 3004;
  duplicateItem.echoDetails[1].sourceId = "3004";
  duplicateItem.snapshot.echoes[1].sourceId = "3004";
  duplicateItem.snapshot.echoes[1].name = "Second Base Echo";
  duplicateItem.echoDetails[1].detail.PhantomType = 1;
  duplicateItem.echoDetails[1].detail.MainProp.RandGroupId = 503;
  duplicateItem.echoDetails[1].detail.ItemId = 60000015;
  await expectThrow("duplicate base ItemId", () => classifyNormalizedEchoCatalog(duplicateItem.snapshot, duplicateItem.echoDetails), /ItemId .* duplicated/);

  const missingDetail = fixture();
  missingDetail.echoDetails.pop();
  await expectThrow("missing detail", () => classifyNormalizedEchoCatalog(missingDetail.snapshot, missingDetail.echoDetails), /count .* does not match/);
}

async function writeCliFixture(cwd) {
  const { snapshot, echoDetails } = fixture();
  const normalizedRoot = path.join(cwd, ".tmp", "wuwa-game-data-normalized");
  const rawDetailsRoot = path.join(cwd, "data", "sources", "encore", "release", "echoes", "details");
  await mkdir(normalizedRoot, { recursive: true });
  await mkdir(rawDetailsRoot, { recursive: true });
  await writeFile(path.join(normalizedRoot, "normalized-source.json"), `${JSON.stringify(snapshot)}\n`, "utf8");

  const entities = [];
  for (const [index, entry] of echoDetails.entries()) {
    const raw = Buffer.from(`${JSON.stringify(entry.detail)}\n`, "utf8");
    const detailFile = `${String(index + 1).padStart(32, "a")}.json`;
    await writeFile(path.join(rawDetailsRoot, detailFile), raw);
    entities.push({ sourceId: entry.sourceId, detailFile, detailSha256: HASH(raw) });
  }
  const manifest = {
    schemaVersion: 1,
    sourceProvider: "encore",
    sourceApi: "https://api-v2.encore.moe/api/en",
    language: "en",
    dataset: "Release",
    resources: { echoes: { count: entities.length, entities } },
  };
  await writeFile(path.join(cwd, "data", "sources", "encore", "release", "manifest.json"), `${JSON.stringify(manifest)}\n`, "utf8");
}

async function testFixedPathCli() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "wuwa-echo-classifier-"));
  try {
    await writeCliFixture(cwd);
    const result = await runNode([CLI], cwd);
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WUWA_ECHO_CATALOG_CLASSIFICATION=/);
    const classified = JSON.parse(
      await readFile(path.join(cwd, ".tmp", "wuwa-game-data-normalized", "normalized-source.json"), "utf8"),
    );
    assert.equal(classified.echoes.filter((entry) => entry.catalogState === "base").length, 1);

    const argResult = await runNode([CLI, "--input=elsewhere"], cwd);
    assert.equal(argResult.code, 1);
    assert.match(argResult.stderr, /does not accept paths, URLs, or other arguments/);

    if (process.platform !== "win32") {
      const inputPath = path.join(cwd, ".tmp", "wuwa-game-data-normalized", "normalized-source.json");
      const target = path.join(cwd, "outside-normalized.json");
      await rm(inputPath);
      await writeFile(target, `${JSON.stringify(fixture().snapshot)}\n`, "utf8");
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
  testPureClassifier();
  await testHostileInputs();
  await testFixedPathCli();
  console.log("Echo catalog classifier security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
