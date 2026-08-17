import { analyzeGameDatabaseReadiness as analyzeStructuralReadiness } from "./game-database-readiness.mjs";
import {
  assertReviewedCharacterGrowth,
  assertReviewedWeaponGrowth,
} from "./game-stat-progression.mjs";

const CHARACTER_GROWTH_BLOCKER = "character-growth-level-map-unresolved";
const WEAPON_GROWTH_BLOCKER = "weapon-growth-level-map-unresolved";

function canReviewAll(entries, reviewer, label) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  try {
    for (let index = 0; index < entries.length; index += 1) {
      reviewer(entries[index]?.properties, `${label}[${index}].properties`);
    }
    return true;
  } catch {
    // Readiness remains diagnostic for incomplete technical fixtures. The
    // generator independently rejects any non-empty production progression
    // that fails the reviewed mapping.
    return false;
  }
}

function freezeReadiness(base, characterReady, weaponReady, characterCount, weaponCount) {
  return Object.freeze({
    ...base,
    characters: Object.freeze({
      ...base.characters,
      statProgressionReady: characterReady ? characterCount : base.characters.statProgressionReady,
    }),
    weapons: Object.freeze({
      ...base.weapons,
      statProgressionReady: weaponReady ? weaponCount : base.weapons.statProgressionReady,
    }),
  });
}

/**
 * Extends the structural readiness validator with the independently reviewed
 * 96-point Encore Release level/ascension mapping. Historical/incomplete test
 * fixtures remain explicitly unresolved; real snapshots are only promoted to
 * ready when every entity passes the reviewed signature.
 */
export function analyzeReviewedGameDatabaseReadiness(snapshot) {
  const structural = analyzeStructuralReadiness(snapshot);
  const characters = snapshot.characters ?? [];
  const weapons = snapshot.weapons ?? [];
  const characterReady = canReviewAll(
    characters,
    assertReviewedCharacterGrowth,
    "characters",
  );
  const weaponReady = canReviewAll(
    weapons,
    assertReviewedWeaponGrowth,
    "weapons",
  );

  const blockers = structural.blockers.filter((entry) => {
    if (entry.code === CHARACTER_GROWTH_BLOCKER) return !characterReady;
    if (entry.code === WEAPON_GROWTH_BLOCKER) return !weaponReady;
    return true;
  });

  return Object.freeze({
    ...structural,
    readiness: freezeReadiness(
      structural.readiness,
      characterReady,
      weaponReady,
      characters.length,
      weapons.length,
    ),
    blockers: Object.freeze(blockers),
    reviewedMappings: Object.freeze({
      characterGrowth: characterReady ? "encore-release-96-point-pre-post-ascension-v1" : "unresolved",
      weaponGrowth: weaponReady ? "encore-release-96-point-half-step-ascension-v1" : "unresolved",
    }),
  });
}
