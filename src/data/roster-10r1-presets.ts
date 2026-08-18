import type { RecommendedBuildPreset } from "@/domain/models";
import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { roster10R1 } from "./roster-10r1";

const RESONATORS_WITH_RICH_PRESETS = new Set(["aemeath", "chisa"]);

type GeneratedCommunityPreset =
  (typeof generatedCommunityEchoPresets10R1)[keyof typeof generatedCommunityEchoPresets10R1];

const communityPresetsByResonator = generatedCommunityEchoPresets10R1 as Readonly<
  Record<string, GeneratedCommunityPreset | undefined>
>;

const baselineSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · exact Lv90 baseline",
  verifiedAt: "2026-08-18",
  notes:
    "Baseline déterministe couvrant uniquement les statistiques permanentes déjà structurées : base personnage, base arme et statistique secondaire de l’arme. Les nodes permanents du personnage et le passif d’arme ne sont pas intégrés ici.",
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
 * unless that Resonator already owns a richer curated preset. A pinned community
 * Echo loadout is attached only after its promotionStatus becomes "verified".
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

      const communityPreset = communityPresetsByResonator[registry.id];
      const verifiedCommunityPreset =
        communityPreset?.promotionStatus === "verified"
          ? communityPreset
          : undefined;

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
        ...(verifiedCommunityPreset
          ? { echoLoadout: verifiedCommunityPreset.echoLoadout }
          : {}),
        notes: [
          "Baseline endgame de départ : personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
          "UserBuild.finalStats contient uniquement les sources permanentes actuellement résolues par le pipeline exact ; aucune valeur manquante n’est inventée.",
          "Nodes permanents et passif d’arme restent explicitement non résolus à ce checkpoint.",
          ...(verifiedCommunityPreset
            ? [
                `Echo loadout communautaire vérifié : ${verifiedCommunityPreset.name} (${verifiedCommunityPreset.author}), source pin ${verifiedCommunityPreset.sourceBlobSha}.`,
                "Les identités Echo/Sonata ont été résolues vers les IDs locaux et les rolls passent le resolver Echo V1.",
              ]
            : [
                communityPreset
                  ? "Un preset Echo communautaire est archivé mais reste bloqué : au moins une valeur source ne passe pas les tables de rolls vérifiées, donc aucun correctif n’est inventé."
                  : "Aucun preset Echo communautaire entièrement vérifiable n’est promu à ce checkpoint.",
              ]),
        ],
        source: baselineSource,
      } satisfies RecommendedBuildPreset;
    });
