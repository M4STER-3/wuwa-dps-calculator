import { generateGameDatabaseV1 as generateStructuralGameDatabaseV1 } from "./game-database-generator.mjs";
import {
  buildReviewedCharacterStatProgressions,
  buildReviewedWeaponStatProgressions,
} from "./game-stat-progression.mjs";

const RESOLVED_UNKNOWNS = new Set([
  "character level/stat growth source-index mapping",
  "weapon level/stat growth source-index mapping",
]);

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

export function generateReviewedGameDatabaseV1(snapshot) {
  const structural = generateStructuralGameDatabaseV1(snapshot);
  const characterSource = exactSourceIndex(snapshot.characters, "characters");
  const weaponSource = exactSourceIndex(snapshot.weapons, "weapons");

  const characters = structural.database.characters.map((entry) => {
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

  return {
    database: {
      ...structural.database,
      characters,
      weapons,
    },
    report: {
      ...structural.report,
      generatedCharacterStatProgressions: characters.length,
      generatedWeaponStatProgressions: weapons.length,
      statProgressionMapping: {
        characters: "encore-release-96-point-pre-post-ascension-v1",
        weapons: "encore-release-96-point-half-step-ascension-v1",
      },
      unresolved: structural.report.unresolved.filter((entry) => !RESOLVED_UNKNOWNS.has(entry)),
    },
  };
}
