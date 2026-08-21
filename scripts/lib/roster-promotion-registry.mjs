import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const MAX_REGISTRY_BYTES = 256 * 1024;
const BATCH_KEY_PATTERN = /^10R[1-9][0-9]*$/;
const ID_PATTERN = /^[a-z0-9-]{1,100}$/;
const WUWA_ID_PATTERN = /^\d{1,30}$/;
const ELEMENTS = new Set(["Aero", "Glacio", "Electro", "Fusion", "Havoc", "Spectro"]);
const WEAPON_TYPES = new Set(["Broadblade", "Gauntlets", "Pistols", "Rectifier", "Sword"]);

function fail(message) {
  throw new Error(`Roster promotion registry: ${message}`);
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactString(value, label, pattern = undefined) {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) fail(`${label} must be bounded text`);
  if (pattern && !pattern.test(value)) fail(`${label} has an invalid format`);
  return value;
}

function validateEntry(rawEntry, label) {
  const entry = record(rawEntry, label);
  const weapon = record(entry.signatureWeapon, `${label}.signatureWeapon`);
  const validated = {
    id: exactString(entry.id, `${label}.id`, ID_PATTERN),
    wuwaId: exactString(entry.wuwaId, `${label}.wuwaId`, WUWA_ID_PATTERN),
    name: exactString(entry.name, `${label}.name`),
    rarity: entry.rarity,
    element: exactString(entry.element, `${label}.element`),
    weaponType: exactString(entry.weaponType, `${label}.weaponType`),
    weapon: {
      id: exactString(weapon.id, `${label}.signatureWeapon.id`, ID_PATTERN),
      wuwaId: exactString(weapon.wuwaId, `${label}.signatureWeapon.wuwaId`, WUWA_ID_PATTERN),
      name: exactString(weapon.name, `${label}.signatureWeapon.name`),
    },
  };
  if (validated.rarity !== 5) fail(`${label}.rarity must be 5 for reviewed promotion batches`);
  if (!ELEMENTS.has(validated.element)) fail(`${label}.element is unsupported`);
  if (!WEAPON_TYPES.has(validated.weaponType)) fail(`${label}.weaponType is unsupported`);
  return validated;
}

export async function loadRosterPromotionBatch(root, batchKey) {
  if (!BATCH_KEY_PATTERN.test(batchKey)) fail(`invalid batch key ${JSON.stringify(batchKey)}`);
  const registryPath = path.resolve(root, "src/data/roster-promotion-registry.json");
  const relative = path.relative(root, registryPath);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("registry path escapes repository root");
  const metadata = await stat(registryPath);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_REGISTRY_BYTES) fail("registry size is outside the allowed range");
  const realRoot = await realpath(root);
  const realRegistry = await realpath(registryPath);
  const realRelative = path.relative(realRoot, realRegistry);
  if (realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) fail("registry resolves outside repository root");

  let parsed;
  try {
    parsed = JSON.parse(await readFile(registryPath, "utf8"));
  } catch (error) {
    fail(`unable to parse registry: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  const rootRecord = record(parsed, "registry");
  if (rootRecord.version !== 1) fail(`unsupported registry version ${JSON.stringify(rootRecord.version)}`);
  if (!Array.isArray(rootRecord.excludedResonatorIds)) fail("excludedResonatorIds must be an array");
  const excluded = rootRecord.excludedResonatorIds.map((value, index) => exactString(value, `excludedResonatorIds[${index}]`, ID_PATTERN));
  if (!excluded.includes("camellya")) fail("Camellya must remain explicitly excluded");
  const batches = record(rootRecord.batches, "batches");
  const rawBatch = batches[batchKey];
  if (!Array.isArray(rawBatch) || rawBatch.length === 0 || rawBatch.length > 100) fail(`${batchKey} must be a bounded non-empty array`);
  const entries = rawBatch.map((entry, index) => validateEntry(entry, `${batchKey}[${index}]`));

  const unique = (values, label) => {
    if (new Set(values).size !== values.length) fail(`${batchKey} duplicates ${label}`);
  };
  unique(entries.map((entry) => entry.id), "resonator IDs");
  unique(entries.map((entry) => entry.wuwaId), "resonator Wuwa IDs");
  unique(entries.map((entry) => entry.weapon.id), "weapon IDs");
  unique(entries.map((entry) => entry.weapon.wuwaId), "weapon Wuwa IDs");
  for (const entry of entries) {
    if (excluded.includes(entry.id) || /camell/i.test(entry.name)) fail(`${entry.name} is excluded from promotion`);
  }
  return { entries, excluded, registryPath };
}
