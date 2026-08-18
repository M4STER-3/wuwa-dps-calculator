import type { RecommendedBuildPreset } from "@/domain/models";
import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { roster10R1 } from "./roster-10r1";

const RESONATORS_WITH_RICH_PRESETS = new Set(["aemeath", "chisa"]);

const baselineSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · exact Lv90 baseline",
  verifiedAt: "2026-08-18",
  notes:
    "Baseline déterministe couvrant uniquement les statistiques permanentes déjà structurées : base personnage, base arme et statistique secondaire de l’arme. Les nodes permanents du personnage, le passif d’arme, les bonus Sonata et les Echoes ne sont pas intégrés ici.",
};

const allSkillLevels10 = {
  basicAttack: 10,
  resonanceSkill: 10,
  forteCircuit: 10,
  resonanceLiberation: 10,
  introSkill: 10,
} as const;

/**
 * Universal fallback baseline for newly promoted Resonators.
 * Adding a reviewed registry entry automatically receives this exact baseline
 * unless that Resonator already owns a richer curated preset.
 */
export const roster10R1BaselinePresets: readonly RecommendedBuildPreset[] =
  roster10R1
    .filter((entry) => !RESONATORS_WITH_RICH_PRESETS.has(entry.id))
    .map((registry) => {
      const finalStats = generatedCharacterBoxRosterBaselines10R1[
        registry.id as keyof typeof generatedCharacterBoxRosterBaselines10R1
      ];
      if (!finalStats) {
        throw new Error(`Missing exact generated baseline for ${registry.id}`);
      }

      return {
        id: `${registry.id}-s0-l90-signature-baseline-10r1`,
        resonatorId: registry.id,
        label: `${registry.name} S0 Lv90 · baseline 10R1`,
        characterLevel: 90,
        sequence: 0,
        skillLevels: allSkillLevels10,
        weapon: {
          weaponId: registry.signatureWeapon.id,
          level: 90,
          rank: 1,
        },
        finalStats,
        notes: [
          "Baseline endgame de départ : personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
          "UserBuild.finalStats contient uniquement les sources permanentes actuellement résolues par le pipeline exact ; aucune valeur manquante n’est inventée.",
          "Nodes permanents, passif d’arme, Sonata et Echoes restent explicitement non résolus à ce checkpoint.",
          "Le preset Echo recommandé WutheringTools sera ajouté séparément après résolution vérifiée des identités Echo/Sonata locales.",
        ],
        source: baselineSource,
      } satisfies RecommendedBuildPreset;
    });
