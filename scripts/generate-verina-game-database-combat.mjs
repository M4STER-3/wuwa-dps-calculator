import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/verina-game-database-combat.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.verina-game-database-combat.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const WUWA_ID = "1503";
const NAME = "Verina";
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

function fail(message) {
  throw new Error(`Verina GameDatabase combat projection: ${message}`);
}
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function text(value, label, max = 240) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`);
  if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${label} contains control characters`);
  return value;
}
function contained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes repository root`);
}
async function rejectSymlink(candidate, label, allowMissing = false) {
  try {
    if ((await lstat(candidate)).isSymbolicLink()) fail(`${label} must not be a symlink`);
  } catch (error) {
    if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
async function assertRealDirectoryContained(directory, label) {
  const relative = path.relative(await realpath(root), await realpath(directory));
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} resolves outside repository root`);
}
function formulaScaling(raw) {
  if (/\b(?:MAX\s+)?HP\b/i.test(raw)) return "hp";
  if (/\bDEF\b/i.test(raw)) return "defense";
  return "attack";
}
function parseFormula(raw, label) {
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
    if (!Number.isFinite(percent) || percent < 0 || !Number.isInteger(hits) || hits <= 0 || hits > 100) fail(`${label} has invalid term ${index}`);
    groups.push({ percent, hits });
  }
  return groups.length ? { groups, scalingAttribute } : null;
}
function isDamageAttribute(name) {
  if (/(?:DMG\s+Bonus|DMG\s+Amplification|DMG\s+Amp|DMG\s+Increase|DMG\s+Multiplier|Crit\.?\s*DMG)/i.test(name)) return false;
  if (/\bDMG\b/i.test(name)) return true;
  return /^(?:Basic Attack|Heavy Attack|Mid-air Attack|Dodge Counter)(?:\s|$)/i.test(name);
}

contained(inputPath, "input");
contained(outputPath, "output");
await rejectSymlink(inputPath, "input");
const metadata = await stat(inputPath);
if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_SOURCE_BYTES) fail(`input size ${metadata.size} is outside allowed range`);
let database;
try {
  database = record(JSON.parse(await readFile(inputPath, "utf8")), "database");
} catch (error) {
  fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`);
}
if (!Array.isArray(database.characters)) fail("characters must be an array");
const matches = database.characters.filter((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const externalIds = raw.externalIds;
  return externalIds && typeof externalIds === "object" && !Array.isArray(externalIds) && externalIds.wuwa === WUWA_ID;
});
if (matches.length !== 1) fail(`Wuwa ID ${WUWA_ID} resolves to ${matches.length} characters`);
const character = record(matches[0], "character");
if (character.name !== NAME) fail(`Wuwa ID ${WUWA_ID} identity mismatch: ${JSON.stringify(character.name)}`);
if (!Array.isArray(character.skills)) fail("Verina skills must be an array");

const actions = [];
const ids = new Set();
for (const [skillIndex, rawSkill] of character.skills.entries()) {
  const skill = record(rawSkill, `skills[${skillIndex}]`);
  const sourceParameters = record(skill.sourceParameters, `skills[${skillIndex}].sourceParameters`);
  const sourceType = text(sourceParameters.type, `skills[${skillIndex}].type`, 120);
  if (!ACTIVE_SKILL_TYPES.has(sourceType) || !Array.isArray(sourceParameters.attributes)) continue;
  const talent = talentBySourceType[sourceType];
  if (!talent) continue;
  for (const [attributeIndex, rawAttribute] of sourceParameters.attributes.entries()) {
    const attribute = record(rawAttribute, `skills[${skillIndex}].attributes[${attributeIndex}]`);
    const name = text(attribute.name, `attribute[${attributeIndex}].name`);
    if (!isDamageAttribute(name) || !Array.isArray(attribute.values) || attribute.values.length < 10) continue;
    const sourceAttributeId = text(attribute.sourceAttributeId, `${name}.sourceAttributeId`, 160);
    if (!/^[A-Za-z0-9._:-]+$/.test(sourceAttributeId)) fail(`${name} has invalid source attribute id`);
    const parsedByLevel = [];
    let scalingAttribute;
    let supported = true;
    for (let level = 1; level <= 10; level += 1) {
      const parsed = parseFormula(attribute.values[level - 1], `${name}.Lv${level}`);
      if (!parsed || (scalingAttribute !== undefined && scalingAttribute !== parsed.scalingAttribute)) {
        supported = false;
        break;
      }
      scalingAttribute = parsed.scalingAttribute;
      parsedByLevel.push(parsed.groups);
    }
    if (!supported || parsedByLevel.length !== 10 || !scalingAttribute) continue;
    const id = `verina-gamedb-attr-${sourceAttributeId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (ids.has(id)) fail(`duplicate action ${id}`);
    ids.add(id);
    actions.push({
      id,
      sourceAttributeId,
      sourceSkillId: text(sourceParameters.sourceSkillId, `${name}.sourceSkillId`, 160),
      sourceSkillName: text(skill.name, `${name}.sourceSkillName`, 200),
      sourceSkillType: sourceType,
      name: name.replace(/\s+DMG\s*$/i, ""),
      talent,
      scalingAttribute,
      multipliers: parsedByLevel[9],
      multipliersByTalentLevel: Object.fromEntries(parsedByLevel.map((groups, index) => [String(index + 1), groups])),
    });
  }
}
if (!actions.length || actions.length > 160) fail(`projected action count ${actions.length} is invalid`);

await mkdir(outputDirectory, { recursive: true });
await assertRealDirectoryContained(path.dirname(inputPath), "input directory");
await assertRealDirectoryContained(outputDirectory, "output directory");
await rejectSymlink(outputPath, "output", true);
await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from GameDatabase V1 for Verina (Wuwa ID 1503). Do not edit manually. */\nexport const generatedVerinaGameDatabaseCombat = ${JSON.stringify({ sourceItemId: WUWA_ID, name: NAME, actions }, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized);
if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside allowed range`);
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}
console.log(`Generated ${path.relative(root, outputPath)} with ${actions.length} exact Verina damage rows from Wuwa ID ${WUWA_ID}.`);
