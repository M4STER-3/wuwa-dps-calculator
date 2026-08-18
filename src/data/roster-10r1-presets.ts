import type { RecommendedBuildPreset } from "@/domain/models";
import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { roster10R1 } from "./roster-10r1";

const NEW_RESONATOR_IDS = [
  "augusta",
  "brant",
  "calcharo",
  "cantarella",
  "carlotta",
  "cartethyia",
  "changli",
  "ciaccona",
] as const;

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

export const roster10R1BaselinePresets: readonly RecommendedBuildPreset[] =
  NEW_RESONATOR_IDS.map((resonatorId) => {
    const registry = roster10R1.find((entry) => entry.id === resonatorId);
    if (!registry) {
      throw new Error(`Missing reviewed 10R1 registry entry for ${resonatorId}`);
    }

    return {
      id: `${resonatorId}-s0-l90-signature-baseline-10r1`,
      resonatorId,
      label: `${registry.name} S0 Lv90 · baseline 10R1`,
      characterLevel: 90,
      sequence: 0,
      skillLevels: allSkillLevels10,
      weapon: {
        weaponId: registry.signatureWeapon.id,
        level: 90,
        rank: 1,
      },
      finalStats: generatedCharacterBoxRosterBaselines10R1[resonatorId],
      notes: [
        "Baseline endgame de départ : personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
        "UserBuild.finalStats contient uniquement les sources permanentes actuellement résolues par le pipeline exact ; aucune valeur manquante n’est inventée.",
        "Nodes permanents, passif d’arme, Sonata et Echoes restent explicitement non résolus à ce checkpoint.",
        "Le preset Echo recommandé WutheringTools sera ajouté séparément après résolution vérifiée des identités Echo/Sonata locales.",
      ],
      source: baselineSource,
    };
  });
