import type { FinalStats, RecommendedBuildPreset } from "@/domain/models";
import { generatedPreciseCharacterBoxBaselines } from "@/generated/precise-character-box-baselines";
import {
  findPreciseDpsWeapon,
  preciseDpsLoadoutResonators,
} from "./precise-dps-loadouts";

const baselineByResonatorId = generatedPreciseCharacterBoxBaselines as Readonly<
  Record<string, FinalStats | undefined>
>;

const allSkillLevels10 = {
  basicAttack: 10,
  resonanceSkill: 10,
  forteCircuit: 10,
  resonanceLiberation: 10,
  introSkill: 10,
} as const;

const source = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 + WUWA LAB reviewed permanent-stat projection",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "Fail-closed Character Box baseline: exact Lv90 character/weapon bases, exact Lv90 signature secondary, reviewed minor Fortes and R1 permanent signature passive are resolved exactly once into finalStats. Runtime windows and unpromoted Echo/Sonata effects are excluded.",
};

/**
 * Visible Character Box presets for the precise-DPS roster.
 * UserBuild.finalStats remains the only permanent-stat source consumed by combat.
 */
export const preciseCharacterBoxPresets: readonly RecommendedBuildPreset[] =
  preciseDpsLoadoutResonators.map((resonator) => {
    const weapon = findPreciseDpsWeapon(resonator.id);
    const finalStats = baselineByResonatorId[resonator.id];
    if (!weapon || !finalStats) {
      throw new Error(`Missing precise Character Box preset dependency for ${resonator.id}.`);
    }
    if (weapon.type !== resonator.weaponType) {
      throw new Error(`Precise Character Box weapon type mismatch for ${resonator.id}.`);
    }

    return {
      id: `${resonator.id}-s0-l90-signature-precise`,
      resonatorId: resonator.id,
      label: `${resonator.name} S0 Lv90 · signature R1`,
      characterLevel: 90,
      sequence: 0,
      skillLevels: allSkillLevels10,
      progression: {
        inherentSkillsUnlocked: true,
        minorFortesUnlocked: true,
      },
      weapon: {
        weaponId: weapon.id,
        level: 90,
        rank: 1,
      },
      finalStats,
      notes: [
        "Personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
        "Les minor Fortes, la statistique secondaire de l'arme et le passif permanent R1 sont déjà inclus exactement une fois dans finalStats.",
        "Les fenêtres temporaires de personnage/arme restent runtime et ne sont jamais réinjectées dans le panneau permanent.",
        "Aucun Echo/Sonata non promu n'est ajouté silencieusement à ce preset.",
      ],
      source,
    } satisfies RecommendedBuildPreset;
  });
