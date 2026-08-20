import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const inputPath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/reviewed-character-game-database-combat.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.reviewed-character-game-database-combat.${process.pid}.tmp`);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const ACTIVE_SKILL_TYPES = new Set(["Normal Attack", "Resonance Skill", "Forte Circuit", "Resonance Liberation", "Intro Skill"]);
const talentBySourceType = {
  "Normal Attack": "basicAttack",
  "Resonance Skill": "resonanceSkill",
  "Forte Circuit": "forteCircuit",
  "Resonance Liberation": "resonanceLiberation",
  "Intro Skill": "introSkill",
};

const reviewedCharacters = [
  {
    key: "verina", wuwaId: "1503", name: "Verina", expectedDamageRows: 19,
    mappings: [
      { actionId: "verina-basic-1", talent: "basicAttack", sourceAttributeIds: ["1700001"], level10: [{ percent: 37.86, hits: 1 }] },
      { actionId: "verina-basic-2", talent: "basicAttack", sourceAttributeIds: ["1700002"], level10: [{ percent: 51.16, hits: 1 }] },
      { actionId: "verina-basic-3", talent: "basicAttack", sourceAttributeIds: ["1700003"], level10: [{ percent: 25.58, hits: 2 }] },
      { actionId: "verina-basic-4", talent: "basicAttack", sourceAttributeIds: ["1700004"], level10: [{ percent: 67.32, hits: 1 }] },
      { actionId: "verina-basic-5", talent: "basicAttack", sourceAttributeIds: ["1700005"], level10: [{ percent: 71.62, hits: 1 }] },
      { actionId: "verina-heavy", talent: "basicAttack", sourceAttributeIds: ["1700007"], level10: [{ percent: 99.41, hits: 1 }] },
      { actionId: "verina-midair-1", talent: "basicAttack", sourceAttributeIds: ["1700009"], level10: [{ percent: 56.37, hits: 1 }] },
      { actionId: "verina-midair-2", talent: "basicAttack", sourceAttributeIds: ["1700010"], level10: [{ percent: 53.19, hits: 1 }] },
      { actionId: "verina-midair-3", talent: "basicAttack", sourceAttributeIds: ["1700011"], level10: [{ percent: 25.42, hits: 3 }] },
      { actionId: "verina-midair-heavy", talent: "basicAttack", sourceAttributeIds: ["1700013"], level10: [{ percent: 61.64, hits: 1 }] },
      { actionId: "verina-dodge", talent: "basicAttack", sourceAttributeIds: ["1700015"], level10: [{ percent: 129.23, hits: 1 }] },
      { actionId: "verina-botany-experiment", talent: "resonanceSkill", sourceAttributeIds: ["1700016"], level10: [{ percent: 35.79, hits: 3 }, { percent: 71.58, hits: 1 }] },
      { actionId: "verina-starflower-midair", talent: "forteCircuit", sourceAttributeIds: ["1700028", "1700029", "1700030"], level10: [{ percent: 67.64, hits: 1 }, { percent: 63.82, hits: 1 }, { percent: 30.5, hits: 3 }] },
      { actionId: "verina-starflower-heavy", talent: "forteCircuit", sourceAttributeIds: ["1700026"], level10: [{ percent: 64.95, hits: 1 }, { percent: 97.42, hits: 1 }] },
      { actionId: "verina-arboreal-flourish", talent: "resonanceLiberation", sourceAttributeIds: ["1700018"], level10: [{ percent: 198.81, hits: 1 }] },
      { actionId: "verina-intro", talent: "introSkill", sourceAttributeIds: ["1700025"], level10: [{ percent: 99.41, hits: 1 }] },
      { actionId: "verina-coordinated-attack", talent: "resonanceLiberation", sourceAttributeIds: ["1700020"], level10: [{ percent: 9.95, hits: 1 }] },
    ],
  },
  {
    key: "chisa", wuwaId: "1508", name: "Chisa", expectedDamageRows: 27,
    mappings: [
      { actionId: "chisa-basic-1", talent: "basicAttack", sourceAttributeIds: ["1508001"], level10: [{ percent: 16.71, hits: 2 }] },
      { actionId: "chisa-basic-2", talent: "basicAttack", sourceAttributeIds: ["1508002"], level10: [{ percent: 9.55, hits: 1 }, { percent: 19.09, hits: 1 }, { percent: 66.81, hits: 1 }] },
      { actionId: "chisa-death-snip", talent: "basicAttack", sourceAttributeIds: ["1508003"], level10: [{ percent: 29.81, hits: 1 }, { percent: 14.91, hits: 1 }, { percent: 104.34, hits: 1 }] },
      { actionId: "chisa-death-snip-additional", talent: "basicAttack", sourceAttributeIds: ["1508004"], level10: [{ percent: 47.78, hits: 1 }] },
      { actionId: "chisa-thread-withdrawn", talent: "basicAttack", sourceAttributeIds: ["1508006"], level10: [{ percent: 10.15, hits: 2 }, { percent: 47.35, hits: 1 }] },
      { actionId: "chisa-rending-lunge", talent: "basicAttack", sourceAttributeIds: ["1508007"], level10: [{ percent: 15.11, hits: 4 }, { percent: 90.66, hits: 1 }] },
      { actionId: "chisa-heavy", talent: "basicAttack", sourceAttributeIds: ["1508008"], level10: [{ percent: 35.79, hits: 2 }] },
      { actionId: "chisa-midair", talent: "basicAttack", sourceAttributeIds: ["1508009"], level10: [{ percent: 73.96, hits: 1 }] },
      { actionId: "chisa-severed-facet", talent: "basicAttack", sourceAttributeIds: ["1508010"], level10: [{ percent: 44.74, hits: 2 }] },
      { actionId: "chisa-hanging-finality", talent: "basicAttack", sourceAttributeIds: ["1508011"], level10: [{ percent: 11.93, hits: 1 }, { percent: 23.86, hits: 2 }, { percent: 59.65, hits: 1 }] },
      { actionId: "chisa-dodge-counter", talent: "basicAttack", sourceAttributeIds: ["1508012"], level10: [{ percent: 23.86, hits: 1 }, { percent: 47.72, hits: 1 }, { percent: 167.01, hits: 1 }] },
      { actionId: "chisa-eye-retraction", talent: "basicAttack", sourceAttributeIds: ["1508013"], level10: [{ percent: 178.93, hits: 1 }] },
      { actionId: "chisa-eye-of-unraveling", talent: "resonanceSkill", sourceAttributeIds: ["1508021"], level10: [{ percent: 35.79, hits: 1 }] },
      { actionId: "chisa-serrated-loop", talent: "resonanceSkill", sourceAttributeIds: ["1508022"], level10: [{ percent: 17.45, hits: 8 }] },
      { actionId: "chisa-serrated-loop-hold", talent: "resonanceSkill", sourceAttributeIds: ["1508024"], level10: [{ percent: 7.46, hits: 16 }] },
      { actionId: "chisa-moment-of-nihility", talent: "resonanceLiberation", sourceAttributeIds: ["1508031"], level10: [{ percent: 954.29, hits: 1 }] },
      { actionId: "chisa-intro", talent: "introSkill", sourceAttributeIds: ["1508041"], level10: [{ percent: 95.43, hits: 1 }] },
      { actionId: "chisa-sawring-blitz-1", talent: "forteCircuit", sourceAttributeIds: ["1508051"], level10: [{ percent: 11.49, hits: 6 }] },
      { actionId: "chisa-sawring-blitz-2", talent: "forteCircuit", sourceAttributeIds: ["1508052"], level10: [{ percent: 10.64, hits: 8 }] },
      { actionId: "chisa-sawring-blitz-3", talent: "forteCircuit", sourceAttributeIds: ["1508053"], level10: [{ percent: 15.98, hits: 8 }] },
      { actionId: "chisa-sawring-eradication", talent: "forteCircuit", sourceAttributeIds: ["1508054"], level10: [{ percent: 51.54, hits: 1 }, { percent: 206.13, hits: 1 }] },
      { actionId: "chisa-sawring-blitz-2-hold", talent: "forteCircuit", sourceAttributeIds: ["1508059"], level10: [{ percent: 10.64, hits: 10 }] },
      { actionId: "chisa-sawring-blitz-3-hold", talent: "forteCircuit", sourceAttributeIds: ["1508060"], level10: [{ percent: 15.98, hits: 6 }] },
      { actionId: "chisa-sawring-discordance", talent: "forteCircuit", sourceAttributeIds: ["1508061"], level10: [{ percent: 3.58, hits: 3 }] },
      { actionId: "chisa-sawring-falltone", talent: "forteCircuit", sourceAttributeIds: ["1508062"], level10: [{ percent: 3.58, hits: 3 }] },
      { actionId: "chisa-chainsaw-dodge", talent: "forteCircuit", sourceAttributeIds: ["1508063"], level10: [{ percent: 10.64, hits: 8 }] },
      { actionId: "chisa-chainsaw-dodge-hold", talent: "forteCircuit", sourceAttributeIds: ["1508064"], level10: [{ percent: 10.64, hits: 10 }] },
    ],
  },
];

function fail(message) { throw new Error(`Reviewed character GameDatabase combat projection: ${message}`); }
function record(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`); return value; }
function text(value, label, max = 240) { if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`); if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${label} contains control characters`); return value; }
function contained(candidate, label) { const relative = path.relative(root, candidate); if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes repository root`); }
async function rejectSymlink(candidate, label, allowMissing = false) { try { if ((await lstat(candidate)).isSymbolicLink()) fail(`${label} must not be a symlink`); } catch (error) { if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return; throw error; } }
async function assertRealDirectoryContained(directory, label) { const relative = path.relative(await realpath(root), await realpath(directory)); if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} resolves outside repository root`); }
function formulaScaling(raw) { if (/\b(?:MAX\s+)?HP\b/i.test(raw)) return "hp"; if (/\bDEF\b/i.test(raw)) return "defense"; return "attack"; }
function parseFormula(raw, label) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 240) return null;
  const scalingAttribute = formulaScaling(raw);
  const cleaned = raw.replace(/\s*(?:ATK|MAX\s+HP|HP|DEF)\s*/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned || /[^0-9.%*+]/.test(cleaned)) return null;
  const groups = [];
  for (const [index, term] of cleaned.split("+").entries()) {
    const match = /^(\d+(?:\.\d+)?)%(?:\*(\d+))?$/.exec(term);
    if (!match) return null;
    const percent = Number(match[1]); const hits = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isInteger(hits) || hits <= 0 || hits > 100) fail(`${label} has invalid term ${index}`);
    groups.push({ percent, hits });
  }
  return groups.length ? { groups, scalingAttribute } : null;
}
function isDamageAttribute(name) { if (/(?:DMG\s+Bonus|DMG\s+Amplification|DMG\s+Amp|DMG\s+Increase|DMG\s+Multiplier|Crit\.?\s*DMG)/i.test(name)) return false; if (/\bDMG\b/i.test(name)) return true; return /^(?:Basic Attack|Heavy Attack|Mid-air Attack|Dodge Counter)(?::|\s|$)/i.test(name); }
function sameGroups(left, right) { return left.length === right.length && left.every((group, index) => { const expected = right[index]; return expected && group.percent === expected.percent && group.hits === expected.hits; }); }

contained(inputPath, "input"); contained(outputPath, "output"); await rejectSymlink(inputPath, "input");
const metadata = await stat(inputPath); if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_SOURCE_BYTES) fail(`input size ${metadata.size} is outside allowed range`);
let database; try { database = record(JSON.parse(await readFile(inputPath, "utf8")), "database"); } catch (error) { fail(`unable to parse GameDatabase: ${error instanceof Error ? error.message : "unknown error"}`); }
if (!Array.isArray(database.characters)) fail("characters must be an array");

const projection = {};
for (const review of reviewedCharacters) {
  if (!/^[a-z0-9-]+$/.test(review.key)) fail(`invalid review key ${JSON.stringify(review.key)}`);
  const characterMatches = database.characters.filter((raw) => { if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false; const externalIds = raw.externalIds; return externalIds && typeof externalIds === "object" && !Array.isArray(externalIds) && externalIds.wuwa === review.wuwaId; });
  if (characterMatches.length !== 1) fail(`${review.name} Wuwa ID ${review.wuwaId} resolves to ${characterMatches.length} characters`);
  const character = record(characterMatches[0], `${review.name} character`); if (character.name !== review.name) fail(`Wuwa ID ${review.wuwaId} identity mismatch: ${JSON.stringify(character.name)}`); if (!Array.isArray(character.skills)) fail(`${review.name} skills must be an array`);
  const sourceRows = []; const rowIds = new Set();
  for (const [skillIndex, rawSkill] of character.skills.entries()) {
    const skill = record(rawSkill, `${review.name}.skills[${skillIndex}]`); const sourceParameters = record(skill.sourceParameters, `${review.name}.skills[${skillIndex}].sourceParameters`); const sourceType = text(sourceParameters.type, `${review.name}.skills[${skillIndex}].type`, 120);
    if (!ACTIVE_SKILL_TYPES.has(sourceType) || !Array.isArray(sourceParameters.attributes)) continue; const talent = talentBySourceType[sourceType]; if (!talent) continue;
    for (const [attributeIndex, rawAttribute] of sourceParameters.attributes.entries()) {
      const attribute = record(rawAttribute, `${review.name}.skills[${skillIndex}].attributes[${attributeIndex}]`); const name = text(attribute.name, `${review.name}.attribute[${attributeIndex}].name`);
      if (!isDamageAttribute(name) || !Array.isArray(attribute.values) || attribute.values.length < 10) continue;
      const sourceAttributeId = text(attribute.sourceAttributeId, `${review.name}.${name}.sourceAttributeId`, 160); if (!/^[A-Za-z0-9._:-]+$/.test(sourceAttributeId)) fail(`${review.name}.${name} has invalid source attribute id`);
      const parsedByLevel = []; let scalingAttribute; let supported = true;
      for (let level = 1; level <= 10; level += 1) { const parsed = parseFormula(attribute.values[level - 1], `${review.name}.${name}.Lv${level}`); if (!parsed || (scalingAttribute !== undefined && scalingAttribute !== parsed.scalingAttribute)) { supported = false; break; } scalingAttribute = parsed.scalingAttribute; parsedByLevel.push(parsed.groups); }
      if (!supported || parsedByLevel.length !== 10 || !scalingAttribute) continue; if (rowIds.has(sourceAttributeId)) fail(`${review.name} duplicate sourceAttributeId ${sourceAttributeId}`); rowIds.add(sourceAttributeId);
      sourceRows.push({ sourceAttributeId, sourceSkillId: text(sourceParameters.sourceSkillId, `${review.name}.${name}.sourceSkillId`, 160), sourceSkillName: text(skill.name, `${review.name}.${name}.sourceSkillName`, 200), name: name.replace(/\s+DMG\s*$/i, ""), talent, scalingAttribute, multipliersByTalentLevel: Object.fromEntries(parsedByLevel.map((groups, index) => [String(index + 1), groups])) });
    }
  }
  if (sourceRows.length !== review.expectedDamageRows) fail(`${review.name} expected ${review.expectedDamageRows} exact damage rows, received ${sourceRows.length}`);
  const reviewedSourceIds = review.mappings.flatMap((mapping) => mapping.sourceAttributeIds);
  if (new Set(reviewedSourceIds).size !== reviewedSourceIds.length || reviewedSourceIds.length !== sourceRows.length) fail(`${review.name} reviewed sourceAttributeId coverage is not one-to-one with projected rows`);
  for (const row of sourceRows) if (!reviewedSourceIds.includes(row.sourceAttributeId)) fail(`${review.name} unreviewed projected row ${row.sourceAttributeId}: ${row.sourceSkillId} ${row.sourceSkillName} / ${row.name} / Lv10=${JSON.stringify(row.multipliersByTalentLevel["10"] ?? [])}`);
  const mappedActions = review.mappings.map((mapping) => {
    const rows = mapping.sourceAttributeIds.map((sourceAttributeId) => { const matches = sourceRows.filter((row) => row.sourceAttributeId === sourceAttributeId); if (matches.length !== 1) fail(`${review.name}.${mapping.actionId} sourceAttributeId ${sourceAttributeId} resolves to ${matches.length} rows`); const row = matches[0]; if (row.talent !== mapping.talent) fail(`${review.name}.${mapping.actionId} talent mismatch at ${sourceAttributeId}: ${row.talent}`); return row; });
    const level10 = rows.flatMap((row) => row.multipliersByTalentLevel["10"] ?? []); if (!sameGroups(level10, mapping.level10)) fail(`${review.name}.${mapping.actionId} Lv10 mismatch: GameDatabase=${JSON.stringify(level10)} reviewed=${JSON.stringify(mapping.level10)}`);
    const multipliersByTalentLevel = Object.fromEntries(Array.from({ length: 10 }, (_, index) => { const level = String(index + 1); const groups = rows.flatMap((row) => row.multipliersByTalentLevel[level] ?? []); if (groups.length !== mapping.level10.length) fail(`${review.name}.${mapping.actionId} Lv${level} group count mismatch`); return [level, groups]; }));
    return { actionId: mapping.actionId, talent: mapping.talent, sourceAttributeIds: mapping.sourceAttributeIds, multipliersByTalentLevel };
  });
  projection[review.key] = { sourceItemId: review.wuwaId, name: review.name, mappedActions };
}

await mkdir(outputDirectory, { recursive: true }); await assertRealDirectoryContained(path.dirname(inputPath), "input directory"); await assertRealDirectoryContained(outputDirectory, "output directory"); await rejectSymlink(outputPath, "output", true); await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from GameDatabase V1 for reviewed character combat projections. Do not edit manually. */\nexport const generatedReviewedCharacterGameDatabaseCombat = ${JSON.stringify(projection, null, 2)} as const;\n`;
const outputBytes = Buffer.byteLength(serialized); if (outputBytes <= 0 || outputBytes > MAX_OUTPUT_BYTES) fail(`output size ${outputBytes} is outside allowed range`);
try { await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 }); await rename(temporaryPath, outputPath); } catch (error) { await rm(temporaryPath, { force: true }).catch(() => undefined); throw error; }
console.log(`Generated ${path.relative(root, outputPath)} for ${Object.keys(projection).length} reviewed character(s).`);
