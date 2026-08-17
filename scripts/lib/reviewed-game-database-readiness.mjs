import { analyzeGameDatabaseReadiness as analyzeStructuralReadiness } from "./game-database-readiness.mjs";
import {
  assertReviewedCharacterGrowth,
  assertReviewedWeaponGrowth,
} from "./game-stat-progression.mjs";

const RESOLVED_GROWTH_BLOCKERS = new Set([
  "character-growth-level-map-unresolved",
  "weapon-growth-level-map-unresolved",
]);

function freezeReadiness(base, characterCount, weaponCount) {
  return Object.freeze({
    ...base,
    characters: Object.freeze({
      ...base.characters,
      statProgressionReady: characterCount,
    }),
    weapons: Object.freeze({
      ...base.weapons,
      statProgressionReady: weaponCount,
    }),
  });
}

/**
 * Extends the structural readiness validator with the independently reviewed
 * 96-point Encore Release level/ascension mapping. Any future source drift is
 * rejected before the historical unresolved blockers are removed.
 */
export function analyzeReviewedGameDatabaseReadiness(snapshot) {
  const structural = analyzeStructuralReadiness(snapshot);
  const characters = snapshot.characters ?? [];
  const weapons = snapshot.weapons ?? [];

  for (let index = 0; index < characters.length; index += 1) {
    assertReviewedCharacterGrowth(
      characters[index]?.properties,
      `characters[${index}].properties`,
    );
  }
  for (let index = 0; index < weapons.length; index += 1) {
    assertReviewedWeaponGrowth(
      weapons[index]?.properties,
      `weapons[${index}].properties`,
    );
  }

  return Object.freeze({
    ...structural,
    readiness: freezeReadiness(
      structural.readiness,
      characters.length,
      weapons.length,
    ),
    blockers: Object.freeze(
      structural.blockers.filter((entry) => !RESOLVED_GROWTH_BLOCKERS.has(entry.code)),
    ),
    reviewedMappings: Object.freeze({
      characterGrowth: "encore-release-96-point-pre-post-ascension-v1",
      weaponGrowth: "encore-release-96-point-half-step-ascension-v1",
    }),
  });
}
