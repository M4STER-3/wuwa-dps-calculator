import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRosterPromotionBatch } from "./lib/roster-promotion-registry.mjs";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/character-box-roster-10r1.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.character-box-roster-10r1.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 768 * 1024;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const { entries: batch } = await loadRosterPromotionBatch(root, "10R1");

const elementMap = { Aero: "aero", Glacio: "glacio", Electro: "electro", Fusion: "fusion", Havoc: "havoc", Spectro: "spectro" };
const weaponTypeMap = { Broadblade: "broadblade", Gauntlets: "gauntlets", Pistols: "pistols", Rectifier: "rectifier", Sword: "sword" };
const normalizeSemanticLabel = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const skillTypeMap = new Map([
  [normalizeSemanticLabel("Normal Attack"), "basicAttack"],
  [normalizeSemanticLabel("Resonance Skill"), "resonanceSkill"],
  [normalizeSemanticLabel("Forte Circuit"), "forteCircuit"],
  [normalizeSemanticLabel("Resonance Liberation"), "resonanceLiberation"],
  [normalizeSemanticLabel("Intro Skill"), "introSkill"],
]);

function fail(message) { throw new Error(`Character Box roster 10R1 projection: ${message}`); }
function assertContained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes repository root`);
}
async function rejectSymlink(candidate, label, allowMissing = false) {
  try { const metadata = await lstat(candidate); if (metadata.isSymbolicLink()) fail(`${label} must not be a symlink`); }
  catch (error) { if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return; throw error; }
}
async function assertRealDirectoryContained(directory, label) {
  const realRoot = await realpath(root); const realDirectory = await realpath(directory); const relative = path.relative(realRoot, realDirectory);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} resolves outside repository root`);
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
function sourceParametersType(skill, label) { return safeText(record(skill.sourceParameters, `${label}.sourceParameters`).type, `${label}.sourceParameters.type`, 120); }
function indexByWuwaId(entries, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const index = new Map();
  for (const [entryIndex, rawEntry] of entries.entries()) {
    const entry = record(rawEntry, `${label}[${entryIndex}]`); const externalIds = record(entry.externalIds, `${label}[${entryIndex}].externalIds`); const wuwaId = externalIds.wuwa;
    if (typeof wuwaId !== "string" || !/^\d{1,30}$/.test(wuwaId)) continue;
    if (index.has(wuwaId)) fail(`${label} duplicates Wuwa id ${wuwaId}`);
    index.set(wuwaId, entry);
  }
  return index;
}

assertContained(inputPath, "input"); assertContained(outputPath, "output"); await rejectSymlink(inputPath, "input");
const inputMetadata = await stat(inputPath);
if (!inputMetadata.isFile() || inputMetadata.size <= 0 || inputMetadata.size > MAX_SOURCE_BYTES) fail(`input size ${inputMetadata.size} is outside the allowed range`);
let database;
try { database = JSON.parse(await readFile(inputPath, "utf8")); } catch (error) { fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`); }
const rootRecord = record(database, "database");
const charactersByWuwaId = indexByWuwaId(rootRecord.characters, "characters");
const weaponsByWuwaId = indexByWuwaId(rootRecord.weapons, "weapons");

const resonators = [];
const weapons = [];
for (const expected of batch) {
  const character = charactersByWuwaId.get(expected.wuwaId);
  if (!character) fail(`missing GameDatabase character ${expected.wuwaId} (${expected.name})`);
  if (character.name !== expected.name || character.element !== expected.element || character.weaponType !== expected.weaponType || character.rarity !== expected.rarity) fail(`${expected.name} identity does not match reviewed metadata`);
  if (!Array.isArray(character.skills)) fail(`${expected.name}.skills must be an array`);
  const skillNames = {};
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${expected.name}.skills[${skillIndex}]`);
    const semantic = skillTypeMap.get(normalizeSemanticLabel(sourceParametersType(skill, `${expected.name}.skills[${skillIndex}]`)));
    if (!semantic) continue;
    if (Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${expected.name} has multiple ${semantic} skill groups`);
    skillNames[semantic] = safeText(skill.name, `${expected.name}.skills[${skillIndex}].name`, 200);
  }
  for (const semantic of skillTypeMap.values()) if (!Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${expected.name} is missing unambiguous ${semantic} skill data`);
  if (!Array.isArray(character.sequences) || character.sequences.length !== 6) fail(`${expected.name} must have exactly six sequences`);
  const resonanceChain = character.sequences.map((rawSequence, sequenceIndex) => {
    const sequence = record(rawSequence, `${expected.name}.sequences[${sequenceIndex}]`);
    if (!Number.isInteger(sequence.sequence) || sequence.sequence !== sequenceIndex + 1) fail(`${expected.name} sequences must be ordered S1..S6`);
    return { sequence: sequence.sequence, name: safeText(sequence.name, `${expected.name}.sequences[${sequenceIndex}].name`, 200), description: safeText(sequence.description, `${expected.name}.sequences[${sequenceIndex}].description`) };
  });
  resonators.push({ id: expected.id, sourceItemId: expected.wuwaId, name: expected.name, element: elementMap[expected.element], weaponType: weaponTypeMap[expected.weaponType], rarity: expected.rarity, skillNames, resonanceChain });

  const weapon = weaponsByWuwaId.get(expected.weapon.wuwaId);
  if (!weapon) fail(`missing GameDatabase weapon ${expected.weapon.wuwaId} (${expected.weapon.name})`);
  if (weapon.name !== expected.weapon.name || weapon.type !== expected.weaponType || weapon.rarity !== 5) fail(`${expected.weapon.name} identity does not match reviewed metadata`);
  weapons.push({ id: expected.weapon.id, sourceItemId: expected.weapon.wuwaId, name: expected.weapon.name, type: weaponTypeMap[expected.weaponType], rarity: 5 });
}
if (resonators.length !== batch.length || new Set(resonators.map((entry) => entry.id)).size !== batch.length) fail("projection size/uniqueness mismatch");
if (weapons.length !== batch.length || new Set(weapons.map((entry) => entry.id)).size !== batch.length) fail("weapon projection size/uniqueness mismatch");

await mkdir(outputDirectory, { recursive: true }); await assertRealDirectoryContained(path.dirname(inputPath), "input directory"); await assertRealDirectoryContained(outputDirectory, "output directory"); await rejectSymlink(outputPath, "output", true); await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from roster-promotion-registry.json. Do not edit manually. */\nexport const generatedCharacterBoxRoster10R1 = ${JSON.stringify(resonators, null, 2)} as const;\nexport const generatedCharacterBoxWeapons10R1 = ${JSON.stringify(weapons, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside the allowed range`);
try { await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 }); await rename(temporaryPath, outputPath); }
catch (error) { await rm(temporaryPath, { force: true }).catch(() => undefined); throw error; }
console.log(`Generated ${path.relative(root, outputPath)} with ${resonators.length} reviewed Resonators and ${weapons.length} signature weapons (${outputBytes} bytes).`);
