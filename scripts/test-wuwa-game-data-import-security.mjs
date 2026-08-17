import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const IMPORTER = path.join(REPO_ROOT, "scripts", "import-wuwa-game-data.mjs");
const MOCK_FETCH = path.join(REPO_ROOT, "scripts", "test-fixtures", "mock-encore-data-fetch.mjs");

async function runImporter(cwd, testCase, args = []) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", pathToFileURL(MOCK_FETCH).href, IMPORTER, ...args],
      {
        cwd,
        env: { ...process.env, MOCK_ENCORE_DATA_CASE: testCase },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "wuwa-game-data-security-"));
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

async function walkFiles(root) {
  const result = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(child);
      else result.push(child);
    }
  }
  await visit(root);
  return result;
}

function fieldByPath(report, fieldPath) {
  const field = report.fields.find((entry) => entry.path === fieldPath);
  assert.ok(field, `Missing field inventory entry: ${fieldPath}`);
  return field;
}

async function testAuditOnlyLeavesRepositoryUntouchedAndInventoriesFields() {
  await withTempDirectory(async (cwd) => {
    const result = await runImporter(cwd, "safe", ["--audit-only"]);
    assert.equal(result.signal, null);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /WUWA_GAME_DATA_IMPORT_REPORT=/);
    assert.equal(await exists(path.join(cwd, "data", "sources", "encore", "release")), false);

    const auditRoot = path.join(cwd, ".tmp", "wuwa-game-data-audit");
    const inventory = JSON.parse(await readFile(path.join(auditRoot, "field-inventory.json"), "utf8"));
    assert.equal(inventory.schemaVersion, 1);
    assert.equal(inventory.dataset, "Release");

    const description = fieldByPath(inventory, "characters.detail.Description");
    assert.deepEqual(description.string.samples, [
      "A safe character description used to map textual Encore fields.",
    ]);

    const skillMultiplier = fieldByPath(inventory, "characters.detail.Skills[].Multiplier");
    assert.equal(skillMultiplier.number.min, 123.45);
    assert.equal(skillMultiplier.number.max, 123.45);

    const enabled = fieldByPath(inventory, "characters.detail.Nested.Enabled");
    assert.equal(enabled.boolean.trueCount, 1);

    const externalGuide = fieldByPath(inventory, "characters.detail.ExternalGuide");
    assert.deepEqual(externalGuide.string.samples, ["[url:https://evil.example]"]);
    assert.equal(JSON.stringify(externalGuide).includes("user=123"), false);

    const html = fieldByPath(inventory, "characters.detail.HtmlSnippet");
    assert.equal(html.string.htmlLike, 1);
    assert.deepEqual(html.string.samples, ["[omitted:html-like-content]"]);

    const script = fieldByPath(inventory, "characters.detail.ScriptSnippet");
    assert.equal(script.string.scriptLike, 1);
    assert.deepEqual(script.string.samples, ["[omitted:script-like-content]"]);

    const weaponPassive = fieldByPath(inventory, "weapons.detail.Passive.Description");
    assert.deepEqual(weaponPassive.string.samples, ["Increase a stat after a reviewed condition."]);

    const echoSkill = fieldByPath(inventory, "echoes.detail.SkillDescription");
    assert.deepEqual(echoSkill.string.samples, ["Transform into the fixture Echo and deal damage."]);
  });
}

async function testPromotionWritesJsonOnlyAndDoesNotFollowPayloadUrls() {
  await withTempDirectory(async (cwd) => {
    const result = await runImporter(cwd, "safe");
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);

    const rawRoot = path.join(cwd, "data", "sources", "encore", "release");
    const files = await walkFiles(rawRoot);
    assert.ok(files.length >= 9);
    assert.ok(files.every((file) => file.endsWith(".json")), "RAW importer must only persist JSON files");
    assert.equal(await exists(path.join(rawRoot, "field-inventory.json")), true);

    const manifest = JSON.parse(await readFile(path.join(rawRoot, "manifest.json"), "utf8"));
    assert.equal(manifest.dataset, "Release");
    assert.equal(manifest.sourceApi, "https://api-v2.encore.moe/api/en");
    assert.equal(manifest.security.redirects, "disabled");
    assert.deepEqual(
      Object.fromEntries(Object.entries(manifest.resources).map(([key, value]) => [key, value.count])),
      { characters: 1, weapons: 1, echoes: 1 },
    );

    const characterList = await readFile(path.join(rawRoot, "characters", "list.json"), "utf8");
    assert.match(characterList, /evil\.example\/never-follow-me/);
  });
}

async function testDangerousKeysAndContentTypesFailClosed() {
  for (const [testCase, expected] of [
    ["dangerous-key", /forbidden key __proto__/i],
    ["bad-content-type", /must be application\/json/i],
    ["duplicate-id", /duplicate source id/i],
  ]) {
    await withTempDirectory(async (cwd) => {
      const result = await runImporter(cwd, testCase);
      assert.equal(result.code, 1, `${testCase} unexpectedly succeeded`);
      assert.match(`${result.stdout}\n${result.stderr}`, expected);
      assert.equal(await exists(path.join(cwd, "data", "sources", "encore", "release")), false);
    });
  }
}

async function testMissingEntityNeverDeletesLastKnownGoodSnapshot() {
  await withTempDirectory(async (cwd) => {
    const first = await runImporter(cwd, "safe");
    assert.equal(first.code, 0, `${first.stdout}\n${first.stderr}`);
    const manifestPath = path.join(cwd, "data", "sources", "encore", "release", "manifest.json");
    const before = await readFile(manifestPath, "utf8");

    const second = await runImporter(cwd, "missing-character");
    assert.equal(second.code, 1);
    assert.match(`${second.stdout}\n${second.stderr}`, /blocked.*disappeared/i);
    const after = await readFile(manifestPath, "utf8");
    assert.equal(after, before, "blocked import must leave the last known-good snapshot unchanged");
  });
}

async function testUnknownArgumentFailsBeforeNetwork() {
  await withTempDirectory(async (cwd) => {
    const result = await runImporter(cwd, "safe", ["--output=/tmp/evil"]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /unsupported game-data import argument/i);
    assert.equal(await exists(path.join(cwd, "data")), false);
  });
}

async function main() {
  await testAuditOnlyLeavesRepositoryUntouchedAndInventoriesFields();
  await testPromotionWritesJsonOnlyAndDoesNotFollowPayloadUrls();
  await testDangerousKeysAndContentTypesFailClosed();
  await testMissingEntityNeverDeletesLastKnownGoodSnapshot();
  await testUnknownArgumentFailsBeforeNetwork();
  console.log("Encore game-data importer security tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
