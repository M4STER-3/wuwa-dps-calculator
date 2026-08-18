import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const registryPath = path.resolve(root, "src/data/community-echo-preset-registry.json");
const databasePath = path.resolve(root, "public/data/wuwa/game-database-v1.json");
const outputPath = path.resolve(root, "src/generated/community-echo-presets-10r1.ts");
const outputDirectory = path.dirname(outputPath);
const temporaryPath = path.join(outputDirectory, `.community-echo-presets-10r1.${process.pid}.tmp`);
const MAX_REGISTRY_BYTES = 512 * 1024;
const MAX_DATABASE_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 512 * 1024;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const PROMOTION_STATUSES = new Set(["verified", "curated-balanced", "blocked-invalid-roll"]);

const mainStatIds = {
  1: { ATK: "echo-main-1-attack-percent", HP: "echo-main-1-hp-percent", DEF: "echo-main-1-defense-percent" },
  3: {
    ATK: "echo-main-3-attack-percent", HP: "echo-main-3-hp-percent", DEF: "echo-main-3-defense-percent",
    Aero: "echo-main-3-aero-damage", Glacio: "echo-main-3-glacio-damage", Electro: "echo-main-3-electro-damage",
    Fusion: "echo-main-3-fusion-damage", Havoc: "echo-main-3-havoc-damage", Spectro: "echo-main-3-spectro-damage",
    EnergyRegen: "echo-main-3-energy-regen",
  },
  4: {
    ATK: "echo-main-4-attack-percent", HP: "echo-main-4-hp-percent", DEF: "echo-main-4-defense-percent",
    CritRate: "echo-main-4-crit-rate", CritDMG: "echo-main-4-crit-damage",
  },
};

const substatIds = {
  CritRate: "echo-sub-crit-rate", CritDMG: "echo-sub-crit-damage",
  ATK: "echo-sub-attack-percent", ATK_FLAT: "echo-sub-attack-flat",
  HP: "echo-sub-hp-percent", HP_FLAT: "echo-sub-hp-flat",
  DEF: "echo-sub-defense-percent", DEF_FLAT: "echo-sub-defense-flat",
  EnergyRegen: "echo-sub-energy-regen",
  BasicAttackDMGBonus: "echo-sub-basic-attack-damage",
  HeavyAttackDMGBonus: "echo-sub-heavy-attack-damage",
  ResonanceSkillDMGBonus: "echo-sub-resonance-skill-damage",
  ResonanceLiberationDMGBonus: "echo-sub-resonance-liberation-damage",
};

function fail(message) { throw new Error(`Community Echo preset projection: ${message}`); }
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function safeText(value, label, max = 300) {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label} must be bounded printable text`);
  return value;
}
function normalizedName(value) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function assertContained(candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes repository root`);
}
async function rejectSymlink(candidate, label, allowMissing = false) {
  try { const metadata = await lstat(candidate); if (metadata.isSymbolicLink()) fail(`${label} must not be a symlink`); }
  catch (error) { if (allowMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") return; throw error; }
}
async function readBoundedJson(candidate, label, maxBytes) {
  assertContained(candidate, label); await rejectSymlink(candidate, label);
  const metadata = await stat(candidate);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) fail(`${label} size ${metadata.size} is outside the allowed range`);
  try { return JSON.parse(await readFile(candidate, "utf8")); }
  catch (error) { fail(`${label} is invalid JSON: ${error instanceof Error ? error.message : "unknown error"}`); }
}
function uniqueNameIndex(entries, label) {
  if (!Array.isArray(entries)) fail(`${label} must be an array`);
  const index = new Map();
  for (const [position, raw] of entries.entries()) {
    const entry = record(raw, `${label}[${position}]`);
    const name = safeText(entry.name, `${label}[${position}].name`);
    const key = normalizedName(name);
    if (!key) fail(`${label}[${position}].name normalizes to an empty key`);
    const matches = index.get(key) ?? [];
    matches.push(entry);
    index.set(key, matches);
  }
  return index;
}
function exactNamed(index, sourceName, label) {
  const key = normalizedName(safeText(sourceName, label));
  const matches = index.get(key) ?? [];
  if (matches.length !== 1) fail(`${label} resolves to ${matches.length} local entities`);
  return matches[0];
}

const registry = record(await readBoundedJson(registryPath, "registry", MAX_REGISTRY_BYTES), "registry");
if (registry.version !== 1 || registry.source !== "ryanbenson/wuthering-waves-optimizer" || !Array.isArray(registry.presets)) fail("registry header is invalid");
const database = record(await readBoundedJson(databasePath, "GameDatabase", MAX_DATABASE_BYTES), "GameDatabase");
const echoIndex = uniqueNameIndex(database.echoes, "GameDatabase.echoes");
const sonataIndex = uniqueNameIndex(database.sonataSets, "GameDatabase.sonataSets");
const output = {};

for (const [presetIndex, rawPreset] of registry.presets.entries()) {
  const preset = record(rawPreset, `presets[${presetIndex}]`);
  const resonatorId = safeText(preset.resonatorId, `presets[${presetIndex}].resonatorId`, 100);
  if (resonatorId === "camellya") fail("Camellya is explicitly excluded");
  if (Object.prototype.hasOwnProperty.call(output, resonatorId)) fail(`duplicate preset for ${resonatorId}`);
  const sourceBlobSha = safeText(preset.sourceBlobSha, `${resonatorId}.sourceBlobSha`, 40);
  if (!SHA_PATTERN.test(sourceBlobSha)) fail(`${resonatorId}.sourceBlobSha must be a full Git blob SHA`);
  const promotionStatus = safeText(preset.promotionStatus, `${resonatorId}.promotionStatus`, 40);
  if (!PROMOTION_STATUSES.has(promotionStatus)) fail(`${resonatorId}.promotionStatus is unsupported`);
  const promotionNote = preset.promotionNote === undefined ? undefined : safeText(preset.promotionNote, `${resonatorId}.promotionNote`, 1_000);
  if (promotionStatus !== "verified" && !promotionNote) fail(`${resonatorId} non-verbatim preset must explain its promotion status`);
  if (!Array.isArray(preset.echoes) || preset.echoes.length !== 5) fail(`${resonatorId} must provide exactly five Echoes`);

  const equipped = [];
  const sourceEchoToCanonicalId = new Map();
  for (const [echoIndexPosition, rawEcho] of preset.echoes.entries()) {
    const sourceEcho = record(rawEcho, `${resonatorId}.echoes[${echoIndexPosition}]`);
    if (sourceEcho.cost !== 1 && sourceEcho.cost !== 3 && sourceEcho.cost !== 4) fail(`${resonatorId}.echoes[${echoIndexPosition}].cost is invalid`);
    const localEcho = exactNamed(echoIndex, sourceEcho.echo, `${resonatorId}.echoes[${echoIndexPosition}].echo`);
    if (localEcho.cost !== sourceEcho.cost) fail(`${resonatorId}.echoes[${echoIndexPosition}] cost disagrees with GameDatabase`);
    const localSonata = exactNamed(sonataIndex, sourceEcho.sonata, `${resonatorId}.echoes[${echoIndexPosition}].sonata`);
    if (!Array.isArray(localEcho.sonataSetIds) || !localEcho.sonataSetIds.includes(localSonata.id)) fail(`${resonatorId}.echoes[${echoIndexPosition}] selects incompatible Sonata`);
    const primaryMainStatId = mainStatIds[sourceEcho.cost]?.[sourceEcho.mainStat];
    if (!primaryMainStatId) fail(`${resonatorId}.echoes[${echoIndexPosition}] has unsupported main stat ${JSON.stringify(sourceEcho.mainStat)}`);
    if (!Array.isArray(sourceEcho.substats) || sourceEcho.substats.length !== 5) fail(`${resonatorId}.echoes[${echoIndexPosition}] must provide five substats`);
    const substats = sourceEcho.substats.map((rawSubstat, substatIndex) => {
      if (!Array.isArray(rawSubstat) || rawSubstat.length !== 2) fail(`${resonatorId}.echoes[${echoIndexPosition}].substats[${substatIndex}] is invalid`);
      const statId = substatIds[rawSubstat[0]];
      if (!statId) fail(`${resonatorId}.echoes[${echoIndexPosition}] has unsupported substat ${JSON.stringify(rawSubstat[0])}`);
      const value = rawSubstat[1];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${resonatorId}.echoes[${echoIndexPosition}] has invalid substat value`);
      return { statId, value };
    });
    sourceEchoToCanonicalId.set(normalizedName(sourceEcho.echo), localEcho.id);
    equipped.push({ echoId: localEcho.id, sonataSetId: localSonata.id, rarity: 5, level: 25, primaryMainStatId, substats });
  }

  let mainEchoId;
  if (preset.mainEcho !== undefined) {
    const sourceMainEcho = safeText(preset.mainEcho, `${resonatorId}.mainEcho`);
    mainEchoId = sourceEchoToCanonicalId.get(normalizedName(sourceMainEcho));
    if (!mainEchoId) fail(`${resonatorId}.mainEcho is not one of the equipped Echoes`);
  }
  output[resonatorId] = {
    name: safeText(preset.name, `${resonatorId}.name`),
    author: safeText(preset.author, `${resonatorId}.author`),
    sourceBlobSha,
    promotionStatus,
    ...(promotionNote ? { promotionNote } : {}),
    echoLoadout: { echoes: equipped, ...(mainEchoId ? { mainEchoId } : {}) },
  };
}

await mkdir(outputDirectory, { recursive: true });
const realRoot = await realpath(root); const realOutputDirectory = await realpath(outputDirectory);
const relativeOutput = path.relative(realRoot, realOutputDirectory);
if (relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput)) fail("output directory resolves outside repository root");
await rejectSymlink(outputPath, "output", true); await rejectSymlink(temporaryPath, "temporary output", true);
const serialized = `/* Generated from community-echo-preset-registry.json. Do not edit manually. */\nexport const generatedCommunityEchoPresets10R1 = ${JSON.stringify(output, null, 2)} as const;\n`;
const bytes = Buffer.byteLength(serialized);
if (bytes <= 0 || bytes > MAX_OUTPUT_BYTES) fail(`output size ${bytes} is outside the allowed range`);
try { await writeFile(temporaryPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 }); await rename(temporaryPath, outputPath); }
catch (error) { await rm(temporaryPath, { force: true }).catch(() => undefined); throw error; }
console.log(`Generated ${path.relative(root, outputPath)} with ${Object.keys(output).length} community Echo preset candidates (${bytes} bytes).`);
