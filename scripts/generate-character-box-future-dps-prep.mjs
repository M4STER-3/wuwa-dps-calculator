import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const databasePath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const registryPath = path.resolve(root, "src/data/character-box-future-dps-registry.json");
const promotionPath = path.resolve(root, "src/data/roster-promotion-registry.json");
const outputPath = path.resolve(root, "src/generated/character-box-future-dps-prep.ts");
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
const MAX_DATABASE_BYTES = 8 * 1024 * 1024;
const MAX_REGISTRY_BYTES = 64 * 1024;
const ACTIVE_TYPES = new Set([
  "Normal Attack",
  "Resonance Skill",
  "Forte Circuit",
  "Resonance Liberation",
  "Intro Skill",
]);

function fail(message) {
  throw new Error(`Character Box future DPS preparation: ${message}`);
}
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function safeText(value, label, max = 240) {
  if (typeof value !== "string" || value.length === 0 || value.length > max) fail(`${label} must be bounded text`);
  if (/[\u0000-\u001f\u007f]/.test(value)) fail(`${label} contains control characters`);
  return value;
}
async function readBoundedJson(filePath, maxBytes, label) {
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) {
    fail(`${label} size ${metadata.size} is outside the allowed range`);
  }
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
function level90(progression) {
  if (!progression || typeof progression !== "object" || !Array.isArray(progression.points)) return null;
  const matches = progression.points.filter((point) => point && typeof point === "object" && point.level === 90);
  if (matches.length !== 1) return null;
  const value = matches[0].value;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function parseDamageFormula(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return null;
  const scalingAttribute = /\b(?:MAX\s+)?HP\b/i.test(raw)
    ? "hp"
    : /\bDEF\b/i.test(raw)
      ? "defense"
      : "attack";
  const cleaned = raw
    .replace(/\s*(?:ATK|MAX\s+HP|HP|DEF)\s*/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned || /[^0-9.%*+]/.test(cleaned)) return null;
  const groups = [];
  for (const term of cleaned.split("+")) {
    const match = /^(\d+(?:\.\d+)?)%(?:\*(\d+))?$/.exec(term);
    if (!match) return null;
    const percent = Number(match[1]);
    const hits = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isFinite(percent) || percent < 0 || !Number.isInteger(hits) || hits <= 0 || hits > 100) return null;
    groups.push({ percent, hits });
  }
  return groups.length ? { scalingAttribute, groups } : null;
}
function actionCandidates(character) {
  if (!Array.isArray(character.skills)) return [];
  const actions = [];
  const seen = new Set();
  for (const rawSkill of character.skills) {
    if (!rawSkill || typeof rawSkill !== "object") continue;
    const parameters = rawSkill.sourceParameters;
    if (!parameters || typeof parameters !== "object" || !ACTIVE_TYPES.has(parameters.type)) continue;
    if (!Array.isArray(parameters.attributes)) continue;
    for (const rawAttribute of parameters.attributes) {
      if (!rawAttribute || typeof rawAttribute !== "object" || !Array.isArray(rawAttribute.values) || rawAttribute.values.length < 10) continue;
      const parsed = parseDamageFormula(rawAttribute.values[9]);
      if (!parsed) continue;
      const sourceAttributeId = typeof rawAttribute.sourceAttributeId === "string" ? rawAttribute.sourceAttributeId : undefined;
      if (!sourceAttributeId || seen.has(sourceAttributeId)) continue;
      seen.add(sourceAttributeId);
      actions.push({
        sourceSkillId: typeof parameters.sourceSkillId === "string" ? parameters.sourceSkillId : null,
        sourceAttributeId,
        sourceSkillName: typeof rawSkill.name === "string" ? rawSkill.name : "Unknown skill",
        sourceSkillType: parameters.type,
        attributeName: typeof rawAttribute.name === "string" ? rawAttribute.name : "Unknown attribute",
        scalingAttribute: parsed.scalingAttribute,
        multipliersLv10: parsed.groups,
      });
    }
  }
  return actions;
}

const database = record(await readBoundedJson(databasePath, MAX_DATABASE_BYTES, "GameDatabase"), "GameDatabase");
const registry = record(await readBoundedJson(registryPath, MAX_REGISTRY_BYTES, "future registry"), "future registry");
const promotion = record(await readBoundedJson(promotionPath, MAX_REGISTRY_BYTES, "promotion registry"), "promotion registry");
if (registry.version !== 1 || !Array.isArray(registry.entries)) fail("future registry version/entries are invalid");
if (!Array.isArray(database.characters)) fail("GameDatabase.characters must be an array");
const currentBatch = record(promotion.batches, "promotion registry batches")["10R1"];
if (!Array.isArray(currentBatch)) fail("promotion registry 10R1 batch must be an array");
const currentIds = new Set(currentBatch.map((entry) => entry?.id).filter((value) => typeof value === "string"));
const currentNames = new Set(currentBatch.map((entry) => entry?.name).filter((value) => typeof value === "string"));
const seenIds = new Set();
const seenNames = new Set();
const entries = [];

for (const [index, rawEntry] of registry.entries.entries()) {
  const entry = record(rawEntry, `entries[${index}]`);
  const id = safeText(entry.id, `entries[${index}].id`, 80);
  const name = safeText(entry.name, `entries[${index}].name`, 120);
  const displayName = entry.displayName === undefined ? name : safeText(entry.displayName, `entries[${index}].displayName`, 120);
  if (!/^[a-z0-9-]+$/.test(id)) fail(`${id} is not a stable slug`);
  if (seenIds.has(id) || seenNames.has(name)) fail(`future registry duplicates ${id}/${name}`);
  if (currentIds.has(id) || currentNames.has(name)) fail(`${name} already exists in the active 10R1 roster`);
  seenIds.add(id);
  seenNames.add(name);

  const matches = database.characters.filter((character) => character && typeof character === "object" && character.name === name);
  if (matches.length > 1) fail(`${name} resolves to multiple GameDatabase characters`);
  if (matches.length === 0) {
    entries.push({
      id,
      name,
      displayName,
      mechanicsStatus: "partial",
      dpsStatus: "planned",
      gameDataStatus: "unavailable",
      sourceItemId: null,
      rarity: null,
      element: null,
      weaponType: null,
      baseStatsLv90: null,
      actionCandidates: [],
    });
    continue;
  }

  const character = record(matches[0], `${name} GameDatabase character`);
  const externalIds = record(character.externalIds, `${name}.externalIds`);
  const stats = character.stats && typeof character.stats === "object" ? character.stats : {};
  const hp = level90(stats.hp);
  const attack = level90(stats.attack);
  const defense = level90(stats.defense);
  entries.push({
    id,
    name,
    displayName,
    mechanicsStatus: "partial",
    dpsStatus: "planned",
    gameDataStatus: "available",
    sourceItemId: typeof externalIds.wuwa === "string" ? externalIds.wuwa : null,
    rarity: typeof character.rarity === "number" ? character.rarity : null,
    element: typeof character.element === "string" ? character.element : null,
    weaponType: typeof character.weaponType === "string" ? character.weaponType : null,
    baseStatsLv90: hp !== null && attack !== null && defense !== null ? { hp, attack, defense } : null,
    actionCandidates: actionCandidates(character),
  });
}

const visualOverrides = record(registry.visualOverrides, "future registry visualOverrides");
const serialized = `/* Generated from GameDatabase V1 + character-box-future-dps-registry.json. Do not edit manually. */\nexport const generatedCharacterBoxFutureDpsPrep = ${JSON.stringify(entries, null, 2)} as const;\nexport const generatedCharacterBoxVisualOverrides = ${JSON.stringify(visualOverrides, null, 2)} as const;\n`;
await mkdir(path.dirname(outputPath), { recursive: true });
try {
  await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  await rename(temporaryPath, outputPath);
} catch (error) {
  await rm(temporaryPath, { force: true }).catch(() => undefined);
  throw error;
}
console.log(`Generated ${path.relative(root, outputPath)} with ${entries.length} future DPS entries (${entries.filter((entry) => entry.gameDataStatus === "available").length} GameDatabase-ready).`);
