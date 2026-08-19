import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const databasePath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const registryPath = path.resolve(root, "src/data/precise-dps-future-registry.json");
const outputPath = path.resolve(root, "src/generated/precise-dps-future-projection.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.precise-dps-future-projection.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_REGISTRY_BYTES = 128 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_ACTIONS_PER_RESONATOR = 180;
const ACTIVE_SKILL_TYPES = new Set(["Normal Attack", "Resonance Skill", "Forte Circuit", "Resonance Liberation", "Intro Skill"]);
const talentBySourceType = {
  "Normal Attack": "basicAttack",
  "Resonance Skill": "resonanceSkill",
  "Forte Circuit": "forteCircuit",
  "Resonance Liberation": "resonanceLiberation",
  "Intro Skill": "introSkill"
};
const elementMap = { Aero: "aero", Glacio: "glacio", Electro: "electro", Fusion: "fusion", Havoc: "havoc", Spectro: "spectro" };
const weaponTypeMap = { Broadblade: "broadblade", Gauntlets: "gauntlets", Pistols: "pistols", Rectifier: "rectifier", Sword: "sword" };
const normalizeSemanticLabel = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const skillTypeMap = new Map([
  [normalizeSemanticLabel("Normal Attack"), "basicAttack"],
  [normalizeSemanticLabel("Resonance Skill"), "resonanceSkill"],
  [normalizeSemanticLabel("Forte Circuit"), "forteCircuit"],
  [normalizeSemanticLabel("Resonance Liberation"), "resonanceLiberation"],
  [normalizeSemanticLabel("Intro Skill"), "introSkill"]
]);

function fail(message) { throw new Error(`Precise future DPS projection: ${message}`); }
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function safeText(value, label, max = 100_000) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) fail(`${label} contains forbidden control characters`);
  return value;
}
function assertContained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes repository root`);
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
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} resolves outside repository root`);
}
async function readBoundedJson(filePath, maxBytes, label) {
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) fail(`${label} size ${metadata.size} is outside the allowed range`);
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) { return fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : "unknown error"}`); }
}
function exactNamed(entries, name, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const matches = entries.filter((entry) => entry && typeof entry === "object" && entry.name === name);
  if (matches.length !== 1) fail(`${name} resolves to ${matches.length} ${label} entries`);
  return record(matches[0], `${label}:${name}`);
}
function exactLevel90(progression, label) {
  const value = record(progression, label);
  if (!Array.isArray(value.points)) fail(`${label}.points must be an array`);
  const matches = value.points.filter((point) => point && typeof point === "object" && point.level === 90);
  if (matches.length !== 1) fail(`${label} must have exactly one level 90 value`);
  const amount = matches[0].value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail(`${label} level 90 value is invalid`);
  return amount;
}
function sourceParametersType(skill, label) {
  return safeText(record(skill.sourceParameters, `${label}.sourceParameters`).type, `${label}.sourceParameters.type`, 120);
}
function actionId(resonatorId, sourceAttributeId) {
  if (typeof sourceAttributeId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(sourceAttributeId)) fail(`${resonatorId} has an invalid source attribute id`);
  return `precise-${resonatorId}-attr-${sourceAttributeId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
function formulaScaling(text) {
  if (/\b(?:MAX\s+)?HP\b/i.test(text)) return "hp";
  if (/\bDEF\b/i.test(text)) return "defense";
  return "attack";
}
function parseMotionValueFormula(raw, label) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 240) return null;
  const scalingAttribute = formulaScaling(raw);
  const cleaned = raw.replace(/\s*(?:ATK|MAX\s+HP|HP|DEF)\s*/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned || /[^0-9.%*+]/.test(cleaned)) return null;
  const groups = [];
  for (const [index, term] of cleaned.split("+").entries()) {
    const match = /^(\d+(?:\.\d+)?)%(?:\*(\d+))?$/.exec(term);
    if (!match) return null;
    const percent = Number(match[1]);
    const hits = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isInteger(hits) || hits <= 0 || hits > 100) fail(`${label} has an invalid damage term at ${index}`);
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
  if (name.includes("basic attack") || name.includes("basic atk") || name.includes("mid-air attack") || name.includes("mid-air atk") || name.includes("dodge counter") || /\bstage\s*\d+/i.test(attributeName)) return "basicAttack";
  if (sourceType === "Normal Attack") return "basicAttack";
  if (sourceType === "Resonance Skill") return "resonanceSkill";
  if (sourceType === "Resonance Liberation") return "resonanceLiberation";
  if (sourceType === "Intro Skill") return "introSkill";
  return undefined;
}
function isDamageAttribute(name) {
  if (/(?:DMG\s+Bonus|DMG\s+Amplification|DMG\s+Amp|DMG\s+Increase|DMG\s+Multiplier|Crit\.?\s*DMG)/i.test(name)) return false;
  if (/\bDMG\b/i.test(name)) return true;
  return /^(?:Basic Attack|Heavy Attack|Mid-air Attack|Dodge Counter)(?:\s|$)/i.test(name);
}
function projectActions(character, resonatorId) {
  if (!Array.isArray(character.skills)) fail(`${resonatorId}.skills must be an array`);
  const actions = [];
  const ids = new Set();
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${resonatorId}.skills[${skillIndex}]`);
    const sourceParameters = record(skill.sourceParameters, `${resonatorId}.skills[${skillIndex}].sourceParameters`);
    const sourceType = safeText(sourceParameters.type, `${resonatorId}.skills[${skillIndex}].type`, 120);
    if (!ACTIVE_SKILL_TYPES.has(sourceType) || !Array.isArray(sourceParameters.attributes)) continue;
    const talent = talentBySourceType[sourceType];
    if (!talent) continue;
    for (const [attributeIndex, rawAttribute] of sourceParameters.attributes.entries()) {
      const attribute = record(rawAttribute, `${resonatorId}.skills[${skillIndex}].attributes[${attributeIndex}]`);
      const name = safeText(attribute.name, `${resonatorId}.attribute.name`, 240);
      if (!isDamageAttribute(name) || !Array.isArray(attribute.values) || attribute.values.length < 10) continue;
      const parsedByLevel = [];
      let scalingAttribute;
      let supported = true;
      for (let level = 1; level <= 10; level += 1) {
        const parsed = parseMotionValueFormula(attribute.values[level - 1], `${resonatorId}.${name}.Lv${level}`);
        if (!parsed || (scalingAttribute !== undefined && scalingAttribute !== parsed.scalingAttribute)) { supported = false; break; }
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
          "Projected generically from exact GameDatabase skill-attribute values; animation timing remains scenario-owned.",
          ...(damageType ? [] : ["Damage type remains unresolved until an explicit precise-DPS override is provided."])
        ],
        source: {
          kind: "verified-game-data",
          source: "WUWA GameDatabase V1 · precise DPS projection",
          notes: `Source skill ${sourceParameters.sourceSkillId}; attribute ${attribute.sourceAttributeId}.`
        }
      });
      if (actions.length > MAX_ACTIONS_PER_RESONATOR) fail(`${resonatorId} exceeds ${MAX_ACTIONS_PER_RESONATOR} projected actions`);
    }
  }
  if (!actions.length) fail(`${resonatorId} produced no exact damage actions`);
  return actions;
}
function projectSkillNames(character, resonatorId) {
  const skillNames = {};
  if (!Array.isArray(character.skills)) fail(`${resonatorId}.skills must be an array`);
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${resonatorId}.skills[${skillIndex}]`);
    const semantic = skillTypeMap.get(normalizeSemanticLabel(sourceParametersType(skill, `${resonatorId}.skills[${skillIndex}]`)));
    if (!semantic) continue;
    if (Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${resonatorId} has multiple ${semantic} skill groups`);
    skillNames[semantic] = safeText(skill.name, `${resonatorId}.skills[${skillIndex}].name`, 200);
  }
  for (const semantic of skillTypeMap.values()) if (!Object.prototype.hasOwnProperty.call(skillNames, semantic)) fail(`${resonatorId} is missing unambiguous ${semantic} skill data`);
  return skillNames;
}
function projectSequences(character, resonatorId) {
  if (!Array.isArray(character.sequences) || character.sequences.length !== 6) fail(`${resonatorId} must have exactly six sequences`);
  return character.sequences.map((rawSequence, sequenceIndex) => {
    const sequence = record(rawSequence, `${resonatorId}.sequences[${sequenceIndex}]`);
    if (!Number.isInteger(sequence.sequence) || sequence.sequence !== sequenceIndex + 1) fail(`${resonatorId} sequences must be ordered S1..S6`);
    return {
      sequence: sequence.sequence,
      name: safeText(sequence.name, `${resonatorId}.sequences[${sequenceIndex}].name`, 200),
      description: safeText(sequence.description, `${resonatorId}.sequences[${sequenceIndex}].description`)
    };
  });
}

assertContained(databasePath, "database");
assertContained(registryPath, "registry");
assertContained(outputPath, "output");
await rejectSymlink(databasePath, "database");
await rejectSymlink(registryPath, "registry");
const database = record(await readBoundedJson(databasePath, MAX_SOURCE_BYTES, "GameDatabase"), "GameDatabase");
const registry = record(await readBoundedJson(registryPath, MAX_REGISTRY_BYTES, "precise registry"), "precise registry");
if (registry.version !== 1 || !Array.isArray(registry.entries)) fail("precise registry version/entries are invalid");
if (!Array.isArray(database.characters) || !Array.isArray(database.weapons)) fail("GameDatabase character/weapon arrays are missing");
const projection = {};
const seenIds = new Set();
for (const [index, rawEntry] of registry.entries.entries()) {
  const entry = record(rawEntry, `entries[${index}]`);
  const id = safeText(entry.id, `entries[${index}].id`, 100);
  const name = safeText(entry.name, `entries[${index}].name`, 160);
  const signatureWeaponName = safeText(entry.signatureWeaponName, `entries[${index}].signatureWeaponName`, 200);
  if (!/^[a-z0-9-]+$/.test(id) || seenIds.has(id)) fail(`${id} is duplicate or not a stable slug`);
  seenIds.add(id);
  const character = exactNamed(database.characters, name, "characters");
  const weapon = exactNamed(database.weapons, signatureWeaponName, "weapons");
  const characterStats = record(character.stats, `${id}.character.stats`);
  const weaponBaseStats = record(weapon.baseStats, `${id}.weapon.baseStats`);
  const externalIds = record(character.externalIds, `${id}.character.externalIds`);
  const weaponExternalIds = record(weapon.externalIds, `${id}.weapon.externalIds`);
  const element = elementMap[character.element];
  const weaponType = weaponTypeMap[character.weaponType];
  if (!element || !weaponType) fail(`${id} has unsupported element/weapon type`);
  if (weapon.type !== character.weaponType) fail(`${signatureWeaponName} is not compatible with ${name}`);
  if (character.rarity !== 5 || weapon.rarity !== 5) fail(`${id} precise baseline expects 5-star character and signature weapon`);
  projection[id] = {
    id,
    sourceItemId: typeof externalIds.wuwa === "string" ? externalIds.wuwa : null,
    name,
    element,
    weaponType,
    rarity: 5,
    skillNames: projectSkillNames(character, id),
    resonanceChain: projectSequences(character, id),
    baseStats: {
      level: 90,
      hp: exactLevel90(characterStats.hp, `${id}.hp`),
      attack: exactLevel90(characterStats.attack, `${id}.attack`),
      defense: exactLevel90(characterStats.defense, `${id}.defense`),
      critRate: 5,
      critDamage: 150,
      energyRegen: 100
    },
    weapon: {
      id: `precise-${id}-signature`,
      sourceItemId: typeof weaponExternalIds.wuwa === "string" ? weaponExternalIds.wuwa : null,
      name: signatureWeaponName,
      type: weaponType,
      rarity: 5,
      level90Stats: { baseAttack: exactLevel90(weaponBaseStats.attack, `${id}.weapon.attack`) }
    },
    actions: projectActions(character, id),
    mechanicsStatus: entry.mechanicsStatus,
    scenarios: entry.scenarios
  };
}
if (Object.keys(projection).length !== registry.entries.length) fail("projection size mismatch");

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(databasePath), "database directory");
await assertRealDirectoryContained(path.dirname(registryPath), "registry directory");
await assertRealDirectoryContained(outputDirectory, "output directory");
await rejectSymlink(outputPath, "output", true);
await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from GameDatabase V1 + precise-dps-future-registry.json. Do not edit manually. */\nexport const generatedPreciseDpsFutureProjection = ${JSON.stringify(projection, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside the allowed range`);
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}
console.log(`Generated ${path.relative(root, outputPath)} with ${Object.keys(projection).length} precise future projections (${outputBytes} bytes).`);
