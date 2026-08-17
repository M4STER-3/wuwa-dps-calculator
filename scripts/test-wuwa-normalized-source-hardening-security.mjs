import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildStableSonataIdentityIndex,
  hardenNormalizedSourceSnapshot,
  toSingleLineName,
} from "./lib/normalized-source-hardening.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const HARDENER = path.join(REPO_ROOT, "scripts", "harden-wuwa-normalized-source.mjs");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixtureNormalized() {
  return {
    schemaVersion: 1,
    sourceProvider: "encore",
    language: "en",
    dataset: "Release",
    sourceImportedAt: "2026-08-17T00:00:00.000Z",
    counts: { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 },
    sourceHashes: {
      characters: { "1": "a".repeat(64) },
      weapons: { "2": "b".repeat(64) },
      echoes: { "3": "c".repeat(64) },
    },
    characters: [
      {
        sourceId: "1",
        name: "Fixture\nCharacter",
        element: "Fusion",
        weaponType: "Sword",
        rarity: 5,
        maxLevel: 90,
        properties: [{ name: "ATK", baseValue: 100, sourceGrowthValues: [] }],
        skills: [
          {
            sourceSkillId: "101",
            name: "Named\nSkill",
            type: "Resonance Skill",
            description: "Description line one.\nDescription line two.",
            attributes: [{ sourceAttributeId: "1", name: "Damage\nRatio", values: ["100%"] }],
          },
          {
            sourceSkillId: "102",
            type: "Inherent Skill",
            description: "Unnamed remains unnamed.",
            attributes: [],
          },
        ],
        resonanceChain: Array.from({ length: 6 }, (_, index) => ({
          sequence: index + 1,
          sourceNodeId: String(index + 1),
          name: index === 0 ? "Sequence\nOne" : `Sequence ${index + 1}`,
          description: `Description ${index + 1}.`,
        })),
        permanentPropertyNodes: [{ sourceNodeId: "501", title: "ATK\nBonus", description: "Keep\nlines." }],
      },
    ],
    weapons: [
      {
        sourceId: "2",
        name: "Fixture\nSword",
        weaponType: "Sword",
        rarity: 5,
        properties: [{ name: "Crit.\nRate", baseValue: 0.08, sourceGrowthValues: [] }],
        passive: { name: "Fixture\nPassive", descriptionTemplate: "Keep template.", rankParameterSets: [] },
        breaches: [],
      },
    ],
    echoes: [
      {
        sourceId: "3",
        name: "Fixture\nEcho",
        qualityId: 5,
        sourceRarity: 3,
        levelUpGroupId: 4,
        sourceSonataGroupIds: [1],
        skill: { sourceSkillId: "301", description: "Echo\ndescription." },
      },
    ],
    sonataSets: [
      {
        name: "Molten\nRift",
        bonuses: [
          { pieces: 2, description: "Bonus line one.\nBonus line two." },
          { pieces: 5, description: "Second bonus." },
        ],
      },
    ],
    diagnostics: [],
  };
}

function fixtureEchoDetail({ id = 1, name = "Molten\nRift", reference = 1 } = {}) {
  return {
    MonsterId: 3,
    FetterGroup: [reference],
    FetterGroupDetails: [
      {
        Group: {
          Id: id,
          FetterGroupName: name,
          FetterMap: [
            { Key: 2, Value: "Bonus one." },
            { Key: 5, Value: "Bonus two." },
          ],
        },
      },
    ],
    FetterDetails: {
      [name]: {
        EffectKeys: [2, 5],
        EffectDescriptions: ["Bonus one.", "Bonus two."],
      },
    },
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

function testSingleLineNamesKeepDescriptionsSeparate() {
  const normalized = fixtureNormalized();
  const hardened = hardenNormalizedSourceSnapshot(normalized, [
    { sourceId: "3", detail: fixtureEchoDetail() },
  ]);

  assert.equal(hardened.characters[0].name, "Fixture Character");
  assert.equal(hardened.characters[0].skills[0].name, "Named Skill");
  assert.equal(hardened.characters[0].skills[0].attributes[0].name, "Damage Ratio");
  assert.equal(hardened.characters[0].resonanceChain[0].name, "Sequence One");
  assert.equal(hardened.characters[0].permanentPropertyNodes[0].title, "ATK Bonus");
  assert.equal(hardened.weapons[0].name, "Fixture Sword");
  assert.equal(hardened.weapons[0].properties[0].name, "Crit. Rate");
  assert.equal(hardened.weapons[0].passive.name, "Fixture Passive");
  assert.equal(hardened.echoes[0].name, "Fixture Echo");
  assert.equal(hardened.sonataSets[0].name, "Molten Rift");

  assert.equal(
    hardened.characters[0].skills[0].description,
    "Description line one.\nDescription line two.",
    "descriptions must retain reviewed line breaks",
  );
  assert.equal(hardened.characters[0].permanentPropertyNodes[0].description, "Keep\nlines.");
  assert.equal(hardened.echoes[0].skill.description, "Echo\ndescription.");
  assert.equal(hardened.sonataSets[0].bonuses[0].description, "Bonus line one.\nBonus line two.");
  assert.equal("name" in hardened.characters[0].skills[1], false, "unnamed source skills stay unnamed");

  assert.equal(hardened.sonataSets[0].sourceId, "1");
  assert.deepEqual(hardened.echoes[0].sourceSonataGroupIds, [1]);
  assert.ok(hardened.diagnostics.some((entry) => entry.code === "sonata-stable-source-id-reviewed"));
}

async function testIdentityConflictsFailClosed() {
  await expectThrow(
    "same id different name",
    () => buildStableSonataIdentityIndex([
      { sourceId: "3", detail: fixtureEchoDetail({ id: 1, name: "Molten Rift" }) },
      { sourceId: "4", detail: fixtureEchoDetail({ id: 1, name: "Moonlit Clouds" }) },
    ]),
    /conflicting names/,
  );

  await expectThrow(
    "same name different id",
    () => buildStableSonataIdentityIndex([
      { sourceId: "3", detail: fixtureEchoDetail({ id: 1, name: "Molten Rift", reference: 1 }) },
      { sourceId: "4", detail: fixtureEchoDetail({ id: 2, name: "Molten Rift", reference: 2 }) },
    ]),
    /conflicting source IDs/,
  );

  const missingReference = fixtureEchoDetail({ id: 1, name: "Molten Rift", reference: 2 });
  await expectThrow(
    "unresolved local reference",
    () => buildStableSonataIdentityIndex([{ sourceId: "3", detail: missingReference }]),
    /references Sonata source ID 2 without a structured local definition/,
  );

  const unmatchedDefinition = fixtureEchoDetail();
  unmatchedDefinition.FetterDetails["Moonlit Clouds"] = unmatchedDefinition.FetterDetails["Molten\nRift"];
  await expectThrow(
    "definition without structured id",
    () => buildStableSonataIdentityIndex([{ sourceId: "3", detail: unmatchedDefinition }]),
    /has no structured source ID/,
  );

  await expectThrow(
    "forbidden name control",
    () => toSingleLineName("bad\u0000name"),
    /forbidden control character/,
  );
}

async function testFixedPathHardenerAndSymlinkGuard() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "wuwa-normalized-hardening-"));
  try {
    const normalizedRoot = path.join(cwd, ".tmp", "wuwa-game-data-normalized");
    const rawRoot = path.join(cwd, "data", "sources", "encore", "release");
    const detailsRoot = path.join(rawRoot, "echoes", "details");
    await mkdir(normalizedRoot, { recursive: true });
    await mkdir(detailsRoot, { recursive: true });

    const detail = fixtureEchoDetail();
    detail.MonsterId = 3;
    const detailBytes = Buffer.from(`${JSON.stringify(detail)}\n`, "utf8");
    const detailFile = "0123456789abcdef0123456789abcdef.json";
    await writeFile(path.join(detailsRoot, detailFile), detailBytes);
    await writeFile(
      path.join(rawRoot, "manifest.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        sourceProvider: "encore",
        sourceApi: "https://api-v2.encore.moe/api/en",
        language: "en",
        dataset: "Release",
        resources: {
          echoes: {
            count: 1,
            entities: [
              { sourceId: "3", detailFile, detailSha256: sha256(detailBytes) },
            ],
          },
        },
      })}\n`,
      "utf8",
    );
    await writeFile(
      path.join(normalizedRoot, "normalized-source.json"),
      `${JSON.stringify(fixtureNormalized())}\n`,
      "utf8",
    );

    const result = await runNode([HARDENER], cwd);
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WUWA_NORMALIZED_SOURCE_HARDENING=/);
    const hardened = JSON.parse(
      await readFile(path.join(normalizedRoot, "normalized-source.json"), "utf8"),
    );
    assert.equal(hardened.characters[0].resonanceChain[0].name, "Sequence One");
    assert.equal(hardened.sonataSets[0].sourceId, "1");

    const argResult = await runNode([HARDENER, "--input=/tmp/evil"], cwd);
    assert.equal(argResult.code, 1);
    assert.match(argResult.stderr, /does not accept filesystem, network, or other arguments/);

    if (process.platform !== "win32") {
      await rm(path.join(normalizedRoot, "normalized-source.json"));
      const target = path.join(cwd, "elsewhere.json");
      await writeFile(target, `${JSON.stringify(fixtureNormalized())}\n`, "utf8");
      await symlink(target, path.join(normalizedRoot, "normalized-source.json"), "file");
      const symlinkResult = await runNode([HARDENER], cwd);
      assert.equal(symlinkResult.code, 1);
      assert.match(symlinkResult.stderr, /symbolic links are forbidden/);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function main() {
  testSingleLineNamesKeepDescriptionsSeparate();
  await testIdentityConflictsFailClosed();
  await testFixedPathHardenerAndSymlinkGuard();
  console.log("Normalized source hardening security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
