import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRosterPromotionBatch } from "./lib/roster-promotion-registry.mjs";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/character-box-combat-10r1.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.character-box-combat-10r1.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_ACTIONS_PER_RESONATOR = 160;
const ACTIVE_SKILL_TYPES = new Set([
  "Normal Attack",
  "Resonance Skill",
  "Forte Circuit",
  "Resonance Liberation",
  "Intro Skill",
]);
const talentBySourceType = {
  "Normal Attack": "basicAttack",
  "Resonance Skill": "resonanceSkill",
  "Forte Circuit": "forteCircuit",
  "Resonance Liberation": "resonanceLiberation",
  "Intro Skill": "introSkill",
};
const { entries: batch } = await loadRosterPromotionBatch(root, "10R1");

function fail(message) {
  throw new Error(`Character Box 10R1 combat projection: ${message}`);
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
  return value;
}
function safeText(value, label, max = 500) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`);
  if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${label} contains control characters`);
  return value;
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
  if (value.interpolation !== "none" || !Array.isArray(value.points)) fail(`${label} is not a reviewed non-interpolated progression`);
  const matches = value.points.filter((point) => point && typeof point === "object" && point.level === 90);
  if (matches.length !== 1) fail(`${label} must have exactly one level 90 value`);
  const amount = matches[0].value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail(`${label} level 90 value is invalid`);
  return amount;
}
function actionId(resonatorId, sourceAttributeId) {
  if (typeof sourceAttributeId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(sourceAttributeId)) {
    fail(`${resonatorId} has an invalid source attribute id`);
  }
  return `roster-${resonatorId}-attr-${sourceAttributeId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
function formulaScaling(text) {
  if (/\b(?:MAX\s+)?HP\b/i.test(text)) return "hp";
  if (/\bDEF\b/i.test(text)) return "defense";
  return "attack";
}
function parseMotionValueFormula(raw, label) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return null;
  const scalingAttribute = formulaScaling(raw);
  const cleaned = raw
    .replace(/\s*(?:ATK|MAX\s+HP|HP|DEF)\s*/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned || /[^0-9.%*+]/.test(cleaned)) return null;
  const groups = [];
  for (const [index, term] of cleaned.split("+").entries()) {
    const match = /^(\d+(?:\.\d+)?)%(?:\*(\d+))?$/.exec(term);
    if (!match) return null;
    const percent = Number(match[1]);
    const hits = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isInteger(hits) || hits <= 0 || hits > 100) {
      fail(`${label} has an invalid damage term at ${index}`);
    }
    groups.push({ percent, hits });
  }
  return groups.length ? { groups, scalingAttribute } : null;
}
function inferDamageType(attributeName, sourceType) {
  const name = attributeName.toLowerCase();
  if (name.includes("echo")) return "echoSkill";
  if (name.includes("heavy attack") || name.includes("heavy atk")) return "heavyAttack";
  if (name.includes("resonance liberation") || name.includes("liberation")) return "resonanceLiberation";
  if (name.includes("resonance skill")) return "resonanceSkill";
  if (name.includes("intro")) return "introSkill";
  if (
    name.includes("basic attack") ||
    name.includes("basic atk") ||
    name.includes("mid-air attack") ||
    name.includes("mid-air atk") ||
    name.includes("dodge counter") ||
    /\bstage\s*\d+/i.test(attributeName)
  ) {
    return "basicAttack";
  }
  if (sourceType === "Normal Attack") return "basicAttack";
  if (sourceType === "Resonance Skill") return "resonanceSkill";
  if (sourceType === "Resonance Liberation") return "resonanceLiberation";
  if (sourceType === "Intro Skill") return "introSkill";
  return undefined;
}
function isDamageAttribute(name) {
  return /\bDMG\b/i.test(name) &&
    !/(?:DMG\s+Bonus|DMG\s+Amplification|DMG\s+Amp|DMG\s+Increase|DMG\s+Multiplier|Crit\.? ?DMG)/i.test(name);
}
function projectActions(character, resonatorId) {
  if (!Array.isArray(character.skills)) fail(`${resonatorId}.skills must be an array`);
  const actions = [];
  const ids = new Set();
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${resonatorId}.skills[${skillIndex}]`);
    const sourceParameters = record(skill.sourceParameters, `${resonatorId}.skills[${skillIndex}].sourceParameters`);
    const sourceType = safeText(sourceParameters.type, `${resonatorId}.skills[${skillIndex}].type`, 120);
    if (!ACTIVE_SKILL_TYPES.has(sourceType)) continue;
    if (!Array.isArray(sourceParameters.attributes)) continue;
    const talent = talentBySourceType[sourceType];
    if (!talent) continue;
    for (const [attributeIndex, rawAttribute] of sourceParameters.attributes.entries()) {
      const attribute = record(rawAttribute, `${resonatorId}.skills[${skillIndex}].attributes[${attributeIndex}]`);
      const name = safeText(attribute.name, `${resonatorId}.attribute.name`, 240);
      if (!isDamageAttribute(name)) continue;
      if (!Array.isArray(attribute.values) || attribute.values.length < 10) continue;
      const parsedByLevel = [];
      let scalingAttribute;
      let supported = true;
      for (let level = 1; level <= 10; level += 1) {
        const parsed = parseMotionValueFormula(attribute.values[level - 1], `${resonatorId}.${name}.Lv${level}`);
        if (!parsed) {
          supported = false;
          break;
        }
        if (scalingAttribute !== undefined && scalingAttribute !== parsed.scalingAttribute) {
          supported = false;
          break;
        }
        scalingAttribute = parsed.scalingAttribute;
        parsedByLevel.push(parsed.groups);
      }
      if (!supported || parsedByLevel.length !== 10 || !scalingAttribute) continue;
      const id = actionId(resonatorId, attribute.sourceAttributeId);
      if (ids.has(id)) fail(`${resonatorId} duplicates projected action id ${id}`);
      ids.add(id);
      const damageType = inferDamageType(name, sourceType);
      actions.push({
        id,
        name: name.replace(/\s+DMG\s*$/i, ""),
        sourceAttributeId: attribute.sourceAttributeId,
        sourceSkillId: sourceParameters.sourceSkillId,
        sourceSkillName: skill.name,
        sourceSkillType: sourceType,
        talent,
        ...(damageType ? { damageType } : {}),
        scaling: "damage",
        scalingAttribute,
        level: 10,
        multipliers: parsedByLevel[9],
        multipliersByTalentLevel: Object.fromEntries(parsedByLevel.map((groups, index) => [String(index + 1), groups])),
        castDurationSeconds: { value: null, confidence: "unknown" },
        recoverySeconds: { value: null, confidence: "unknown" },
        hitTimingsSeconds: { value: null, confidence: "unknown" },
        notes: [
          "Projected generically from exact GameDatabase skill-attribute values; animation timing remains theoretical.",
          ...(damageType ? [] : ["Damage type is intentionally unresolved and requires a data override before rotation use."]),
        ],
        source: {
          kind: "verified-game-data",
          source: "WUWA GameDatabase V1 · Release skill projection",
          notes: `Source skill ${sourceParameters.sourceSkillId}; attribute ${attribute.sourceAttributeId}.`,
        },
      });
      if (actions.length > MAX_ACTIONS_PER_RESONATOR) fail(`${resonatorId} exceeds ${MAX_ACTIONS_PER_RESONATOR} projected actions`);
    }
  }
  return actions;
}

assertContained(inputPath, "input");
assertContained(outputPath, "output");
await rejectSymlink(inputPath, "input");
const metadata = await stat(inputPath);
if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_SOURCE_BYTES) {
  fail(`input size ${metadata.size} is outside the allowed range`);
}
let database;
try {
  database = JSON.parse(await readFile(inputPath, "utf8"));
} catch (error) {
  fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`);
}
const rootRecord = record(database, "database");
const characters = indexByWuwaId(rootRecord.characters, "characters");
const weapons = indexByWuwaId(rootRecord.weapons, "weapons");
const projection = {};

for (const entry of batch) {
  const character = characters.get(entry.wuwaId);
  const weapon = weapons.get(entry.weapon.wuwaId);
  if (!character || !weapon) fail(`missing character/weapon pair for ${entry.id}`);
  if (character.name !== entry.name || weapon.name !== entry.weapon.name) fail(`identity mismatch for ${entry.id}`);
  const characterStats = record(character.stats, `${entry.id}.character.stats`);
  const weaponBaseStats = record(weapon.baseStats, `${entry.id}.weapon.baseStats`);
  const baseStats = {
    level: 90,
    hp: exactLevel90(characterStats.hp, `${entry.id}.hp`),
    attack: exactLevel90(characterStats.attack, `${entry.id}.attack`),
    defense: exactLevel90(characterStats.defense, `${entry.id}.defense`),
    critRate: 5,
    critDamage: 150,
    energyRegen: 100,
  };
  const weaponLevel90 = {
    baseAttack: exactLevel90(weaponBaseStats.attack, `${entry.id}.weapon.attack`),
  };
  const actions = projectActions(character, entry.id);
  if (!actions.length) fail(`${entry.id} produced no exact damage actions`);
  projection[entry.id] = {
    sourceItemId: entry.wuwaId,
    baseStats,
    weaponLevel90,
    actions,
  };
}
if (Object.keys(projection).length !== batch.length) fail("projection size mismatch");

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "input directory");
await assertRealDirectoryContained(outputDirectory, "output directory");
await rejectSymlink(outputPath, "output", true);
await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from GameDatabase V1 + roster-promotion-registry.json. Do not edit manually. */\nexport const generatedCharacterBoxCombat10R1 = ${JSON.stringify(projection, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) {
  fail(`output size ${outputBytes} is outside the allowed range`);
}
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}
console.log(`Generated ${path.relative(root, outputPath)} with ${Object.keys(projection).length} combat projections (${outputBytes} bytes).`);
