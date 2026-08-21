import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const databasePath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const reviewedPath = path.resolve(root, "src/data/precise-character-box-reviewed-stats.json");
const outputPath = path.resolve(root, "src/generated/precise-character-box-baselines.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.precise-character-box-baselines.${process.pid}.tmp`);
const MAX_DATABASE_BYTES = 8 * 1024 * 1024;
const MAX_REVIEWED_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 128 * 1024;
const EXPECTED_ENTRIES = 10;
const STAT_KEYS = new Set([
  "hpPercent",
  "attackPercent",
  "defensePercent",
  "critRate",
  "critDamage",
  "energyRegen",
  "healingBonus",
  "aeroDamageBonus",
  "glacioDamageBonus",
  "electroDamageBonus",
  "fusionDamageBonus",
  "havocDamageBonus",
  "spectroDamageBonus",
]);

function fail(message) {
  throw new Error(`Precise Character Box baseline projection: ${message}`);
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function boundedId(value, label, pattern = /^[a-z0-9-]{1,100}$/) {
  if (typeof value !== "string" || !pattern.test(value)) fail(`${label} has an invalid format`);
  return value;
}

function boundedName(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) fail(`${label} must be bounded text`);
  return value;
}

function percentagePoints(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 200) {
    fail(`${label} must be finite percentage points in 0..200`);
  }
  return value;
}

function reviewedStats(value, label) {
  const source = record(value ?? {}, label);
  for (const key of Object.keys(source)) {
    if (!STAT_KEYS.has(key)) fail(`${label}.${key} is unsupported`);
  }
  return Object.fromEntries(
    [...STAT_KEYS].map((key) => [key, percentagePoints(source[key] ?? 0, `${label}.${key}`)]),
  );
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

async function readJsonFile(candidate, label, maxBytes) {
  assertContained(candidate, label);
  await rejectSymlink(candidate, label);
  const metadata = await stat(candidate);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) {
    fail(`${label} size ${metadata.size} is outside the allowed range`);
  }
  try {
    return JSON.parse(await readFile(candidate, "utf8"));
  } catch (error) {
    fail(`unable to parse ${label}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function indexByWuwaId(entries, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const index = new Map();
  for (const [entryIndex, rawEntry] of entries.entries()) {
    const entry = record(rawEntry, `${label}[${entryIndex}]`);
    const externalIds = record(entry.externalIds, `${label}[${entryIndex}].externalIds`);
    const id = externalIds.wuwa;
    if (typeof id !== "string" || !/^\d{1,30}$/.test(id)) continue;
    if (index.has(id)) fail(`${label} duplicates Wuwa id ${id}`);
    index.set(id, entry);
  }
  return index;
}

function exactLevel90(progression, label) {
  const value = record(progression, label);
  if (value.interpolation !== "none" || !Array.isArray(value.points)) {
    fail(`${label} is not a reviewed non-interpolated progression`);
  }
  const matches = value.points.filter((point) => point && typeof point === "object" && point.level === 90);
  if (matches.length !== 1) fail(`${label} must have exactly one level 90 value`);
  const amount = matches[0].value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail(`${label} level 90 value is invalid`);
  return amount;
}

function blankStats() {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    critRate: 5,
    critDamage: 150,
    energyRegen: 100,
    healingBonus: 0,
    tuneBreakBoost: 0,
    elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
    damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
  };
}

function addReviewedPanel(stats, target) {
  stats.critRate += target.critRate;
  stats.critDamage += target.critDamage;
  stats.energyRegen += target.energyRegen;
  stats.healingBonus += target.healingBonus;
  stats.elementalDamageBonus.aero += target.aeroDamageBonus;
  stats.elementalDamageBonus.glacio += target.glacioDamageBonus;
  stats.elementalDamageBonus.electro += target.electroDamageBonus;
  stats.elementalDamageBonus.fusion += target.fusionDamageBonus;
  stats.elementalDamageBonus.havoc += target.havocDamageBonus;
  stats.elementalDamageBonus.spectro += target.spectroDamageBonus;
}

const database = record(await readJsonFile(databasePath, "GameDatabase", MAX_DATABASE_BYTES), "database");
const reviewedRoot = record(await readJsonFile(reviewedPath, "reviewed precise Character Box stats", MAX_REVIEWED_BYTES), "reviewed stats");
if (reviewedRoot.version !== 1) fail(`unsupported reviewed stats version ${JSON.stringify(reviewedRoot.version)}`);
if (!Array.isArray(reviewedRoot.entries) || reviewedRoot.entries.length !== EXPECTED_ENTRIES) {
  fail(`reviewed stats must contain exactly ${EXPECTED_ENTRIES} entries`);
}

const characters = indexByWuwaId(database.characters, "characters");
const weapons = indexByWuwaId(database.weapons, "weapons");
const baselines = {};
const audit = {};
const seenIds = new Set();
const seenCharacterIds = new Set();
const seenWeaponIds = new Set();

for (const [index, rawEntry] of reviewedRoot.entries.entries()) {
  const entry = record(rawEntry, `entries[${index}]`);
  const id = boundedId(entry.id, `entries[${index}].id`);
  const name = boundedName(entry.name, `entries[${index}].name`);
  const wuwaId = boundedId(entry.wuwaId, `entries[${index}].wuwaId`, /^\d{1,30}$/);
  const weaponReview = record(entry.weapon, `entries[${index}].weapon`);
  const weaponId = boundedId(weaponReview.id, `entries[${index}].weapon.id`);
  const weaponName = boundedName(weaponReview.name, `entries[${index}].weapon.name`);
  const weaponWuwaId = boundedId(weaponReview.wuwaId, `entries[${index}].weapon.wuwaId`, /^\d{1,30}$/);
  if (seenIds.has(id) || seenCharacterIds.has(wuwaId) || seenWeaponIds.has(weaponWuwaId)) fail(`duplicate reviewed identity for ${id}`);
  seenIds.add(id);
  seenCharacterIds.add(wuwaId);
  seenWeaponIds.add(weaponWuwaId);

  const character = characters.get(wuwaId);
  const weapon = weapons.get(weaponWuwaId);
  if (!character || !weapon) fail(`missing GameDatabase character/weapon pair for ${id}`);
  if (character.name !== name || weapon.name !== weaponName) fail(`identity mismatch for ${id}`);
  if (character.weaponType !== weapon.type) fail(`weapon type mismatch for ${id}`);

  const minorFortes = reviewedStats(entry.minorFortes, `${id}.minorFortes`);
  const weaponPermanent = reviewedStats(entry.weaponPermanent, `${id}.weaponPermanent`);
  const stats = blankStats();
  const characterStats = record(character.stats, `${id}.character.stats`);
  const baseHp = exactLevel90(characterStats.hp, `${id}.hp`);
  const baseCharacterAttack = exactLevel90(characterStats.attack, `${id}.attack`);
  const baseDefense = exactLevel90(characterStats.defense, `${id}.defense`);
  const baseStats = record(weapon.baseStats, `${id}.weapon.baseStats`);
  const baseWeaponAttack = exactLevel90(baseStats.attack, `${id}.weapon.attack`);

  let hpPercent = minorFortes.hpPercent + weaponPermanent.hpPercent;
  let attackPercent = minorFortes.attackPercent + weaponPermanent.attackPercent;
  let defensePercent = minorFortes.defensePercent + weaponPermanent.defensePercent;
  let secondaryStat = null;

  if (baseStats.secondaryStat !== undefined) {
    const secondary = record(baseStats.secondaryStat, `${id}.weapon.secondaryStat`);
    if (secondary.unit !== "percentage-points") fail(`${id} weapon secondary unit is unsupported`);
    const amount = exactLevel90(secondary.progression, `${id}.weapon.secondaryStat.progression`);
    secondaryStat = { stat: secondary.stat, amount };
    switch (secondary.stat) {
      case "ATK": attackPercent += amount; break;
      case "HP": hpPercent += amount; break;
      case "DEF": defensePercent += amount; break;
      case "Crit. Rate": stats.critRate += amount; break;
      case "Crit. DMG": stats.critDamage += amount; break;
      case "Energy Regen": stats.energyRegen += amount; break;
      default: fail(`${id} weapon secondary stat ${JSON.stringify(secondary.stat)} has no reviewed mapping`);
    }
  }

  addReviewedPanel(stats, minorFortes);
  addReviewedPanel(stats, weaponPermanent);
  stats.hp = baseHp * (1 + hpPercent / 100);
  stats.attack = (baseCharacterAttack + baseWeaponAttack) * (1 + attackPercent / 100);
  stats.defense = baseDefense * (1 + defensePercent / 100);

  baselines[id] = stats;
  audit[id] = {
    characterWuwaId: wuwaId,
    weaponId,
    weaponWuwaId,
    weaponSecondary: secondaryStat,
    minorFortes,
    weaponPermanent,
  };
}

if (Object.keys(baselines).length !== EXPECTED_ENTRIES) fail("projection size mismatch");

assertContained(outputPath, "output");
await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(databasePath), "GameDatabase directory");
await assertRealDirectoryContained(path.dirname(reviewedPath), "reviewed stats directory");
await assertRealDirectoryContained(outputDirectory, "output directory");
await rejectSymlink(outputPath, "output", true);
await rejectSymlink(temporaryPath, "temporary output", true);

const serialized = `/* Generated from precise-character-box-reviewed-stats.json + GameDatabase V1. Do not edit manually. */\nexport const generatedPreciseCharacterBoxBaselines = ${JSON.stringify(baselines, null, 2)} as const;\n\nexport const generatedPreciseCharacterBoxAudit = ${JSON.stringify(audit, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside the allowed range`);

try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}

console.log(`Generated ${path.relative(root, outputPath)} with ${EXPECTED_ENTRIES} reviewed precise Character Box baselines (${outputBytes} bytes).`);
