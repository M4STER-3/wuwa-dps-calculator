import type { FinalStats, RecommendedBuildPreset } from "@/domain/models";
import { generatedPreciseCharacterBoxBaselines } from "@/generated/precise-character-box-baselines";
import { generatedPreciseCharacterBoxEchoPresets } from "@/generated/precise-character-box-echo-presets";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import {
  findPreciseDpsWeapon,
  preciseDpsLoadoutResonators,
} from "./precise-dps-loadouts";

const baselineByResonatorId = generatedPreciseCharacterBoxBaselines as Readonly<
  Record<string, FinalStats | undefined>
>;

type GeneratedEchoPreset =
  (typeof generatedPreciseCharacterBoxEchoPresets)[keyof typeof generatedPreciseCharacterBoxEchoPresets];
const echoPresets = Object.values(generatedPreciseCharacterBoxEchoPresets) as readonly GeneratedEchoPreset[];

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
    "Fail-closed Character Box build: exact Lv90 character/weapon bases, exact signature secondary, reviewed minor Fortes and R1 permanent signature passive are resolved exactly once into finalStats; five legal +25 Echoes are then applied exactly once through Echo Resolver V1. Sonata and Main Echo runtime windows remain data-owned effects.",
};

/**
 * Visible Character Box presets for the precise-DPS roster.
 * UserBuild.finalStats remains the only permanent-stat source consumed by combat.
 * Denia intentionally exposes two equipment variants because Fusion Burst and Tune
 * Strain use different reviewed Sonata/Main Echo packages.
 */
export const preciseCharacterBoxPresets: readonly RecommendedBuildPreset[] =
  preciseDpsLoadoutResonators.flatMap((resonator) => {
    const weapon = findPreciseDpsWeapon(resonator.id);
    const baseline = baselineByResonatorId[resonator.id];
    if (!weapon || !baseline) {
      throw new Error(`Missing precise Character Box preset dependency for ${resonator.id}.`);
    }
    if (weapon.type !== resonator.weaponType) {
      throw new Error(`Precise Character Box weapon type mismatch for ${resonator.id}.`);
    }
    const characterBase = resonator.baseStats?.find((item) => item.level === 90);
    const weaponBase = weapon.level90Stats;
    if (!characterBase || !weaponBase) {
      throw new Error(`Missing exact Lv90 Echo stat basis for ${resonator.id}.`);
    }
    const variants = echoPresets.filter((entry) => entry.resonatorId === resonator.id);
    if (variants.length === 0) {
      throw new Error(`Missing precise five-Echo loadout for ${resonator.id}.`);
    }
    if (resonator.id !== "denia" && variants.length !== 1) {
      throw new Error(`Unexpected precise Echo variant count for ${resonator.id}: ${variants.length}.`);
    }
    if (resonator.id === "denia" && variants.length !== 2) {
      throw new Error(`Denia requires exactly two reviewed Echo variants, got ${variants.length}.`);
    }

    return variants.map((variant) => {
      const finalStats = applyEchoLoadoutStatsV1(
        baseline,
        {
          hp: characterBase.hp,
          attack: characterBase.attack + weaponBase.baseAttack,
          defense: characterBase.defense,
        },
        variant.echoLoadout,
      ).finalStats;
      const variantSuffix = "variant" in variant ? `-${variant.variant.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
      const variantLabel = "variant" in variant ? ` · ${variant.variant}` : "";

      return {
        id: `${resonator.id}-s0-l90-signature-precise${variantSuffix}`,
        resonatorId: resonator.id,
        label: `${resonator.name} S0 Lv90 · signature R1${variantLabel}`,
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
        echoLoadout: variant.echoLoadout,
        mainEchoId: variant.mainEchoCanonicalId,
        notes: [
          "Personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
          "Les minor Fortes, la statistique secondaire de l'arme et le passif permanent R1 sont déjà inclus exactement une fois dans finalStats.",
          `Cinq Echoes +25 légaux (${variant.totalCost}/12 de coût) sont résolus depuis GameDatabase et leurs main/substats sont ajoutés exactement une fois au panneau.`,
          `Main Echo équipé : ${variant.mainEchoName}. Les paliers Sonata sont dérivés des vrais sonataSetId des cinq pièces, sans faux set composite.`,
          "Les fenêtres temporaires de personnage, arme, Sonata et Main Echo restent runtime et ne sont jamais réinjectées dans le panneau permanent.",
        ],
        source,
      } satisfies RecommendedBuildPreset;
    });
  });
