import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRosterPromotionBatch } from "./lib/roster-promotion-registry.mjs";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/character-box-roster-baselines-10r1.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.character-box-roster-baselines-10r1.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 128 * 1024;
const { entries: batch } = await loadRosterPromotionBatch(root, "10R1");

function fail(message) { throw new Error(`Character Box 10R1 baseline projection: ${message}`); }
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
function record(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`); return value; }
function indexByWuwaId(entries, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const index = new Map();
  for (const [entryIndex, rawEntry] of entries.entries()) {
    const entry = record(rawEntry, `${label}[${entryIndex}]`); const externalIds = record(entry.externalIds, `${label}[${entryIndex}].externalIds`); const id = externalIds.wuwa;
    if (typeof id !== "string" || !/^\d{1,30}$/.test(id)) continue;
    if (index.has(id)) fail(`${label} duplicates Wuwa id ${id}`);
    index.set(id, entry);
  }
  return index;
}
function exactLevel90(progression, label) {
  const value = record(progression, label);
  if (value.interpolation !== "none" || !Array.isArray(value.points)) fail(`${label} is not a reviewed non-interpolated progression`);
  const matches = value.points.filter((point) => point && typeof point === "object" && point.level === 90);
  if (matches.length !== 1) fail(`${label} must have exactly one level 90 value`);
  const amount = matches[0].value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail(`${label} level 90 value is invalid`);
  return amount;
}
function blankStats() {
  return {
    hp: 0, attack: 0, defense: 0, critRate: 5, critDamage: 150, energyRegen: 100, healingBonus: 0, tuneBreakBoost: 0,
    elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
    damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
  };
}

assertContained(inputPath, "input"); assertContained(outputPath, "output"); await rejectSymlink(inputPath, "input");
const metadata = await stat(inputPath);
if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_SOURCE_BYTES) fail(`input size ${metadata.size} is outside the allowed range`);
let database;
try { database = JSON.parse(await readFile(inputPath, "utf8")); } catch (error) { fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`); }
const rootRecord = record(database, "database");
const characters = indexByWuwaId(rootRecord.characters, "characters");
const weapons = indexByWuwaId(rootRecord.weapons, "weapons");
const baselines = {};

for (const entry of batch) {
  const character = characters.get(entry.wuwaId); const weapon = weapons.get(entry.weapon.wuwaId);
  if (!character || !weapon) fail(`missing character/weapon pair for ${entry.id}`);
  if (character.name !== entry.name || weapon.name !== entry.weapon.name) fail(`identity mismatch for ${entry.id}`);
  if (character.weaponType !== weapon.type || character.weaponType !== entry.weaponType) fail(`weapon type mismatch for ${entry.id}`);
  const stats = blankStats();
  const characterStats = record(character.stats, `${entry.id}.character.stats`);
  const hp = exactLevel90(characterStats.hp, `${entry.id}.hp`);
  const characterAttack = exactLevel90(characterStats.attack, `${entry.id}.attack`);
  const defense = exactLevel90(characterStats.defense, `${entry.id}.defense`);
  const baseStats = record(weapon.baseStats, `${entry.id}.weapon.baseStats`);
  const weaponAttack = exactLevel90(baseStats.attack, `${entry.id}.weapon.attack`);
  let hpPercent = 0; let attackPercent = 0; let defensePercent = 0;
  if (baseStats.secondaryStat !== undefined) {
    const secondary = record(baseStats.secondaryStat, `${entry.id}.weapon.secondaryStat`);
    if (secondary.unit !== "percentage-points") fail(`${entry.id} weapon secondary unit is unsupported`);
    const amount = exactLevel90(secondary.progression, `${entry.id}.weapon.secondaryStat.progression`);
    switch (secondary.stat) {
      case "ATK": attackPercent += amount; break;
      case "HP": hpPercent += amount; break;
      case "DEF": defensePercent += amount; break;
      case "Crit. Rate": stats.critRate += amount; break;
      case "Crit. DMG": stats.critDamage += amount; break;
      case "Energy Regen": stats.energyRegen += amount; break;
      default: fail(`${entry.id} weapon secondary stat ${JSON.stringify(secondary.stat)} has no reviewed mapping`);
    }
  }
  stats.hp = hp * (1 + hpPercent / 100);
  stats.attack = (characterAttack + weaponAttack) * (1 + attackPercent / 100);
  stats.defense = defense * (1 + defensePercent / 100);
  baselines[entry.id] = stats;
}
if (Object.keys(baselines).length !== batch.length) fail("projection size mismatch");

await mkdir(outputDirectory, { recursive: true }); await assertRealDirectoryContained(path.dirname(inputPath), "input directory"); await assertRealDirectoryContained(outputDirectory, "output directory"); await rejectSymlink(outputPath, "output", true); await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from roster-promotion-registry.json. Do not edit manually. */\nexport const generatedCharacterBoxRosterBaselines10R1 = ${JSON.stringify(baselines, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside the allowed range`);
try { await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 }); await rename(temporaryPath, outputPath); }
catch (error) { await rm(temporaryPath, { force: true }).catch(() => undefined); throw error; }
console.log(`Generated ${path.relative(root, outputPath)} with ${Object.keys(baselines).length} exact level 90 baselines (${outputBytes} bytes).`);
