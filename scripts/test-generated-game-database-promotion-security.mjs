import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const VERIFIER = path.join(REPO_ROOT, "scripts", "verify-generated-game-database.mjs");
const WORKFLOW = path.join(REPO_ROOT, ".github", "workflows", "game-database-promotion.yml");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const IMPORTED_AT = "2026-08-17T00:00:00.000Z";

const source = (externalId, hash) => ({
  provider: "encore",
  externalId,
  language: "en",
  dataset: "Release",
  importedAt: IMPORTED_AT,
  sourceHash: hash,
});

function safeDatabase() {
  return {
    manifest: {
      schemaVersion: 1,
      dataset: "Release",
      generatedAt: IMPORTED_AT,
      sourceProvider: "encore",
      sourceImportedAt: IMPORTED_AT,
      counts: { characters: 1, weapons: 1, echoes: 1, sonataSets: 1 },
    },
    characters: [{
      kind: "character",
      id: "character:1001",
      externalIds: { encore: "1001" },
      name: "Fixture Resonator",
      source: source("1001", HASH_A),
      rarity: 5,
      element: "spectro",
      weaponType: "sword",
      skills: [],
      sequences: [],
    }],
    weapons: [{
      kind: "weapon",
      id: "weapon:2001",
      externalIds: { encore: "2001" },
      name: "Fixture Sword",
      source: source("2001", HASH_B),
      type: "sword",
      rarity: 5,
      baseStats: {},
    }],
    echoes: [{
      kind: "echo",
      id: "echo:3001",
      externalIds: { encore: "3001", wuwa: "6000001" },
      name: "Fixture Echo",
      source: source("3001", HASH_C),
      cost: 1,
      sonataSetIds: ["sonata-set:9001"],
      echoSkill: { description: "Inert plain-text Echo skill." },
    }],
    sonataSets: [{
      kind: "sonata-set",
      id: "sonata-set:9001",
      externalIds: { encore: "9001" },
      name: "Fixture Sonata",
      source: source("9001", HASH_D),
      bonuses: [{ pieces: 2, description: "Plain-text fixture bonus." }],
    }],
  };
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

async function writeModeDatabase(cwd, mode, value) {
  const relative = mode === "--generated"
    ? path.join(".tmp", "wuwa-game-database-v1", "game-database-v1.json")
    : mode === "--artifact"
      ? path.join(".tmp", "game-database-promotion-download", "game-database-v1.json")
      : path.join("public", "data", "wuwa", "game-database-v1.json");
  const target = path.join(cwd, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value)}\n`, "utf8");
  return target;
}

async function expectRejected(label, cwd, mode, pattern) {
  const result = await runNode([VERIFIER, mode], cwd);
  assert.equal(result.signal, null, label);
  assert.equal(result.code, 1, `${label}: expected failure\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, pattern, label);
}

async function testVerifierModesAndAttacks() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "wuwa-db-promotion-"));
  try {
    for (const mode of ["--generated", "--artifact", "--public"]) {
      await writeModeDatabase(cwd, mode, safeDatabase());
      const result = await runNode([VERIFIER, mode], cwd);
      assert.equal(result.signal, null);
      assert.equal(result.code, 0, `${mode}\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /WUWA_GENERATED_GAME_DATABASE_VERIFY=/);
    }

    const argResult = await runNode([VERIFIER, "--elsewhere"], cwd);
    assert.equal(argResult.code, 1);
    assert.match(argResult.stderr, /only --generated, --artifact, or --public/);

    const urlDb = safeDatabase();
    urlDb.echoes[0].echoSkill.description = "Visit https://attacker.invalid/payload";
    await writeModeDatabase(cwd, "--generated", urlDb);
    await expectRejected("URL leak", cwd, "--generated", /HTTP\(S\) URL leaked/);

    const scriptDb = safeDatabase();
    scriptDb.sonataSets[0].bonuses[0].description = "<script>alert(1)</script>";
    await writeModeDatabase(cwd, "--generated", scriptDb);
    await expectRejected("script text", cwd, "--generated", /script-like text/);

    const duplicateDb = safeDatabase();
    duplicateDb.characters.push({ ...duplicateDb.characters[0], externalIds: { encore: "1002" }, source: source("1002", HASH_A) });
    duplicateDb.manifest.counts.characters = 2;
    await writeModeDatabase(cwd, "--generated", duplicateDb);
    await expectRejected("duplicate canonical ID", cwd, "--generated", /duplicates canonical ID/);

    const unknownSonataDb = safeDatabase();
    unknownSonataDb.echoes[0].sonataSetIds = ["sonata-set:9999"];
    await writeModeDatabase(cwd, "--generated", unknownSonataDb);
    await expectRejected("unknown Sonata", cwd, "--generated", /references unknown Sonata/);

    const badHashDb = safeDatabase();
    badHashDb.echoes[0].source.sourceHash = "not-a-hash";
    await writeModeDatabase(cwd, "--generated", badHashDb);
    await expectRejected("bad source hash", cwd, "--generated", /sourceHash is not SHA-256/);

    const dangerousRaw = JSON.stringify(safeDatabase()).replace(
      '"manifest":{',
      '"__proto__":{"polluted":true},"manifest":{',
    );
    const generatedPath = await writeModeDatabase(cwd, "--generated", safeDatabase());
    await writeFile(generatedPath, `${dangerousRaw}\n`, "utf8");
    await expectRejected("dangerous key", cwd, "--generated", /dangerous object key __proto__/);

    if (process.platform !== "win32") {
      await rm(generatedPath);
      const target = path.join(cwd, "outside.json");
      await writeFile(target, `${JSON.stringify(safeDatabase())}\n`, "utf8");
      await symlink(target, generatedPath, "file");
      await expectRejected("symlink", cwd, "--generated", /symbolic links are forbidden/);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function testWorkflowPolicy() {
  const workflow = await readFile(WORKFLOW, "utf8");
  assert.match(workflow, /branches:\s*\n\s*- ['"]game-data-promotion\/\*\*['"]/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /build:\s*[\s\S]*?permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /promote:\s*[\s\S]*?permissions:\s*\n\s*contents: write/);
  assert.match(workflow, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(workflow, /public\/data\/wuwa\/game-database-v1\.json/);
  assert.match(workflow, /\.tmp\/game-database-promotion-artifact/);
  assert.doesNotMatch(workflow, /pull-requests:\s*write/);

  const promote = workflow.slice(workflow.indexOf("  promote:"));
  assert.ok(promote.length > 0, "promote job must exist");
  assert.doesNotMatch(promote, /game-data:import/);
  assert.doesNotMatch(promote, /api-v2\.encore\.moe/);

  const uploadBlock = workflow.slice(workflow.indexOf("actions/upload-artifact@"), workflow.indexOf("  promote:"));
  assert.doesNotMatch(uploadBlock, /data\/sources\/encore|wuwa-game-data-normalized/);
  assert.match(uploadBlock, /\.tmp\/game-database-promotion-artifact/);
}

async function main() {
  await testVerifierModesAndAttacks();
  await testWorkflowPolicy();
  console.log("Generated GameDatabase promotion security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
