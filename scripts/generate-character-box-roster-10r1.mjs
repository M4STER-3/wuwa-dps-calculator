import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/character-box-roster-10r1.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.character-box-roster-10r1.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const batch = [
  ["aemeath", "1210", "Aemeath", "Fusion", "Sword"],
  ["augusta", "1306", "Augusta", "Electro", "Broadblade"],
  ["brant", "1206", "Brant", "Fusion", "Sword"],
  ["calcharo", "1301", "Calcharo", "Electro", "Broadblade"],
  ["cantarella", "1607", "Cantarella", "Havoc", "Rectifier"],
  ["carlotta", "1107", "Carlotta", "Glacio", "Pistols"],
  ["cartethyia", "1409", "Cartethyia", "Aero", "Sword"],
  ["changli", "1205", "Changli", "Fusion", "Sword"],
  ["chisa", "1508", "Chisa", "Havoc", "Broadblade"],
  ["ciaccona", "1407", "Ciaccona", "Aero", "Pistols"],
];

const elementMap = {
  Aero: "aero",
  Glacio: "glacio",
  Electro: "electro",
  Fusion: "fusion",
  Havoc: "havoc",
  Spectro: "spectro",
};
const weaponTypeMap = {
  Broadblade: "broadblade",
  Gauntlets: "gauntlets",
  Pistols: "pistols",
  Rectifier: "rectifier",
  Sword: "sword",
};
const skillTypeMap = new Map([
  ["Basic Attack", "basicAttack"],
  ["Resonance Skill", "resonanceSkill"],
  ["Forte Circuit", "forteCircuit"],
  ["Resonance Liberation", "resonanceLiberation"],
  ["Intro Skill", "introSkill"],
]);

function fail(message) {
  throw new Error(`Character Box roster 10R1 projection: ${message}`);
}
function assertContained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} escapes repository root`);
  }
}
async function rejectSymlink(candidate, label, allowMissing = false) {
  try {
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) fail(`${label} must not be a symlink`);
  } catch (error) {
    if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
async function assertRealDirectoryContained(directory, label) {
  const realRoot = await realpath(root);
  const realDirectory = await realpath(directory);
  const relative = path.relative(realRoot, realDirectory);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} resolves outside repository root`);
  }
}
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (DANGEROUS_KEYS.has(key)) fail(`${label} contains forbidden key ${key}`);
  return value;
}
function safeText(value, label, max = 100_000) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) fail(`${label} contains forbidden control characters`);
  if (/<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i.test(value)) fail(`${label} contains script-like content`);
  if (/https?:\/\//i.test(value)) fail(`${label} contains an unexpected URL`);
  return value;
}
function sourceParametersType(skill, label) {
  const parameters = record(skill.sourceParameters, `${label}.sourceParameters`);
  return safeText(parameters.type, `${label}.sourceParameters.type`, 120);
}

assertContained(inputPath, "input");
assertContained(outputPath, "output");
await rejectSymlink(inputPath, "input");
const inputMetadata = await stat(inputPath);
if (!inputMetadata.isFile() || inputMetadata.size <= 0 || inputMetadata.size > MAX_SOURCE_BYTES) {
  fail(`input size ${inputMetadata.size} is outside the allowed range`);
}

let database;
try {
  database = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`);
}
const rootRecord = record(database, "database");
if (!Array.isArray(rootRecord.characters)) fail("database.characters must be an array");

const byWuwaId = new Map();
for (const [index, rawCharacter] of rootRecord.characters.entries()) {
  const character = record(rawCharacter, `characters[${index}]`);
  const externalIds = record(character.externalIds, `characters[${index}].externalIds`);
  const wuwaId = externalIds.wuwa;
  if (typeof wuwaId !== "string" || !/^\d{1,30}$/.test(wuwaId)) continue;
  if (byWuwaId.has(wuwaId)) fail(`duplicate Wuwa character id ${wuwaId}`);
  byWuwaId.set(wuwaId, character);
}

const projection = batch.map(([id, wuwaId, expectedName, expectedElement, expectedWeaponType]) => {
  if (id === "camellya" || /camell/i.test(expectedName)) fail("Camellya is explicitly excluded from roster promotion");
  const character = byWuwaId.get(wuwaId);
  if (!character) fail(`missing GameDatabase character ${wuwaId} (${expectedName})`);
  if (character.name !== expectedName) fail(`${wuwaId} expected name ${expectedName}, got ${String(character.name)}`);
  if (character.element !== expectedElement) fail(`${expectedName} expected element ${expectedElement}, got ${String(character.element)}`);
  if (character.weaponType !== expectedWeaponType) fail(`${expectedName} expected weapon type ${expectedWeaponType}, got ${String(character.weaponType)}`);
  if (character.rarity !== 5) fail(`${expectedName} expected rarity 5, got ${String(character.rarity)}`);
  if (!Array.isArray(character.skills)) fail(`${expectedName}.skills must be an array`);

  const skillNames = {};
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${expectedName}.skills[${skillIndex}]`);
    const semantic = skillTypeMap.get(sourceParametersType(skill, `${expectedName}.skills[${skillIndex}]`));
    if (!semantic) continue;
    if (Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${expectedName} has multiple ${semantic} skill groups`);
    skillNames[semantic] = safeText(skill.name, `${expectedName}.skills[${skillIndex}].name`, 200);
  }
  for (const semantic of skillTypeMap.values()) {
    if (!Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${expectedName} is missing unambiguous ${semantic} skill data`);
  }

  if (!Array.isArray(character.sequences) || character.sequences.length !== 6) fail(`${expectedName} must have exactly six sequences`);
  const resonanceChain = character.sequences.map((rawSequence, sequenceIndex) => {
    const sequence = record(rawSequence, `${expectedName}.sequences[${sequenceIndex}]`);
    if (!Number.isInteger(sequence.sequence) || sequence.sequence !== sequenceIndex + 1) fail(`${expectedName} sequences must be ordered S1..S6`);
    return {
      sequence: sequence.sequence,
      name: safeText(sequence.name, `${expectedName}.sequences[${sequenceIndex}].name`, 200),
      description: safeText(sequence.description, `${expectedName}.sequences[${sequenceIndex}].description`),
    };
  });

  return {
    id,
    sourceItemId: wuwaId,
    name: expectedName,
    element: elementMap[expectedElement],
    weaponType: weaponTypeMap[expectedWeaponType],
    rarity: 5,
    skillNames,
    resonanceChain,
  };
});

if (projection.length !== 10 || new Set(projection.map((entry) => entry.id)).size !== 10) fail("projection must contain exactly ten unique Resonators");

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "input directory");
await assertRealDirectoryContained(outputDirectory, "output directory");
await rejectSymlink(outputPath, "output", true);
await rejectSymlink(temporaryPath, "temporary output", true);

const serialized = `/* Generated by scripts/generate-character-box-roster-10r1.mjs. Do not edit manually. */\nexport const generatedCharacterBoxRoster10R1 = ${JSON.stringify(projection, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside the allowed range`);
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}

console.log(`Generated ${path.relative(root, outputPath)} with ${projection.length} reviewed 10R1 Resonators (${outputBytes} bytes).`);
