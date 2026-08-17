import { generateGameDatabaseV1 as generateStructuralGameDatabaseV1 } from "./game-database-generator.mjs";
import {
  buildReviewedCharacterStatProgressions,
  buildReviewedWeaponStatProgressions,
} from "./game-stat-progression.mjs";

const CHARACTER_UNKNOWN = "character level/stat growth source-index mapping";
const WEAPON_UNKNOWN = "weapon level/stat growth source-index mapping";

function exactSourceIndex(entries, label) {
  if (!Array.isArray(entries)) throw new Error(`${label} must be an array`);
  const result = new Map();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const sourceId = entry?.sourceId;
    if (typeof sourceId !== "string" || !/^\d{1,30}$/.test(sourceId)) {
      throw new Error(`${label}[${index}].sourceId is invalid`);
    }
    if (result.has(sourceId)) throw new Error(`${label} duplicates sourceId ${sourceId}`);
    result.set(sourceId, entry);
  }
  return result;
}

function growthCoverage(entries, label) {
  const flags = entries.map((entry, index) => {
    if (!Array.isArray(entry?.properties)) throw new Error(`${label}[${index}].properties must be an array`);
    return entry.properties.length > 0;
  });
  const some = flags.some(Boolean);
  const all = flags.every(Boolean);
  if (some && !all) throw new Error(`${label} contains a partial stat-progression population`);
  return all;
}

export function generateReviewedGameDatabaseV1(snapshot) {
  const structural = generateStructuralGameDatabaseV1(snapshot);
  const characterSource = exactSourceIndex(snapshot.characters, "characters");
  const weaponSource = exactSourceIndex(snapshot.weapons, "weapons");
  const generateCharacterStats = growthCoverage(snapshot.characters, "characters");
  const generateWeaponStats = growthCoverage(snapshot.weapons, "weapons");

  const characters = structural.database.characters.map((entry) => {
    if (!generateCharacterStats) return entry;
    const sourceId = entry.source.externalId;
    const source = characterSource.get(sourceId);
    if (!source) throw new Error(`Generated character ${sourceId} has no normalized source row`);
    return {
      ...entry,
      stats: buildReviewedCharacterStatProgressions(
        source.properties,
        `character ${sourceId}.properties`,
      ),
    };
  });

  const weapons = structural.database.weapons.map((entry) => {
    if (!generateWeaponStats) return entry;
    const sourceId = entry.source.externalId;
    const source = weaponSource.get(sourceId);
    if (!source) throw new Error(`Generated weapon ${sourceId} has no normalized source row`);
    return {
      ...entry,
      baseStats: buildReviewedWeaponStatProgressions(
        source.properties,
        `weapon ${sourceId}.properties`,
      ),
    };
  });

  const unresolved = structural.report.unresolved.filter((entry) => {
    if (entry === CHARACTER_UNKNOWN) return !generateCharacterStats;
    if (entry === WEAPON_UNKNOWN) return !generateWeaponStats;
    return true;
  });

  return {
    database: {
      ...structural.database,
      characters,
      weapons,
    },
    report: {
      ...structural.report,
      generatedCharacterStatProgressions: generateCharacterStats ? characters.length : 0,
      generatedWeaponStatProgressions: generateWeaponStats ? weapons.length : 0,
      statProgressionMapping: {
        characters: generateCharacterStats ? "encore-release-96-point-pre-post-ascension-v1" : "unresolved",
        weapons: generateWeaponStats ? "encore-release-96-point-half-step-ascension-v1" : "unresolved",
      },
      unresolved,
    },
  };
}
