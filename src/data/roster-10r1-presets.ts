import type { RecommendedBuildPreset } from "@/domain/models";
import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCharacterBoxCombat10R1 } from "@/generated/character-box-combat-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import { legacyRosterMainEchoIdByResonatorId } from "./legacy-roster-equipment-runtime";
import { roster10R1 } from "./roster-10r1";

const RESONATORS_WITH_RICH_PRESETS = new Set(["aemeath", "calcharo", "chisa"]);

type GeneratedCommunityPreset =
  (typeof generatedCommunityEchoPresets10R1)[keyof typeof generatedCommunityEchoPresets10R1];

const communityPresetsByResonator = generatedCommunityEchoPresets10R1 as Readonly<
  Record<string, GeneratedCommunityPreset | undefined>
>;
const mainEchoByResonator = legacyRosterMainEchoIdByResonatorId as Readonly<Record<string, string | undefined>>;

const baselineSource = {
  kind: "verified-game-data" as const,
  source: "WUWA GameDatabase V1 · exact Lv90 baseline + reviewed Echo resolver",
  verifiedAt: "2026-08-20",
  notes:
    "Baseline déterministe : base personnage, base arme, statistique secondaire d’arme et cinq Echoes validés sont appliqués exactement une fois. Sonata et Main Echo sont maintenant résolus au runtime depuis les identités GameDatabase; nodes permanents et passifs d’arme encore non structurés restent hors panel.",
};

const allSkillLevels10 = {
  basicAttack: 10,
  resonanceSkill: 10,
  forteCircuit: 10,
  resonanceLiberation: 10,
  introSkill: 10,
} as const;

/**
 * Universal fallback preset for newly promoted Resonators.
 * A reviewed registry row + a promoted Echo recipe automatically receives an exact
 * endgame panel without character-specific code. UserBuild.finalStats remains the
 * sole permanent-stat source consumed by combat engines.
 */
export const roster10R1BaselinePresets: readonly RecommendedBuildPreset[] =
  roster10R1
    .filter((entry) => !RESONATORS_WITH_RICH_PRESETS.has(entry.id))
    .map((registry) => {
      const baseline = generatedCharacterBoxRosterBaselines10R1[
        registry.id as keyof typeof generatedCharacterBoxRosterBaselines10R1
      ];
      const combat = generatedCharacterBoxCombat10R1[
        registry.id as keyof typeof generatedCharacterBoxCombat10R1
      ];
      if (!baseline || !combat) {
        throw new Error(`Missing exact generated baseline/combat projection for ${registry.id}`);
      }

      const communityPreset = communityPresetsByResonator[registry.id];
      const promotedCommunityPreset =
        communityPreset?.promotionStatus === "verified" ||
        communityPreset?.promotionStatus === "curated-balanced"
          ? communityPreset
          : undefined;
      const mainEchoId = mainEchoByResonator[registry.id];

      const finalStats = promotedCommunityPreset
        ? applyEchoLoadoutStatsV1(
            baseline,
            {
              hp: combat.baseStats.hp,
              attack: combat.baseStats.attack + combat.weaponLevel90.baseAttack,
              defense: combat.baseStats.defense,
            },
            promotedCommunityPreset.echoLoadout,
          ).finalStats
        : baseline;

      if (mainEchoId && promotedCommunityPreset) {
        const equippedIds = new Set(promotedCommunityPreset.echoLoadout.echoes.map((echo) => echo.echoId));
        if (!equippedIds.has(mainEchoId)) {
          throw new Error(`Reviewed Main Echo ${mainEchoId} is not equipped by ${registry.id}.`);
        }
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
        ...(promotedCommunityPreset
          ? { echoLoadout: promotedCommunityPreset.echoLoadout }
          : {}),
        ...(mainEchoId ? { mainEchoId } : {}),
        notes: [
          "Baseline endgame : personnage Lv90, S0, talents Lv10, arme signature Lv90 R1.",
          promotedCommunityPreset
            ? "Les statistiques permanentes des cinq Echoes validés sont résolues dans finalStats exactement une fois via Echo Resolver V1."
            : "Aucun Echo promu n’est appliqué au panel ; aucune valeur manquante n’est inventée.",
          mainEchoId
            ? "Le Main Echo équipé et les paliers Sonata réels sont résolus au runtime; aucun de leurs bonus temporaires n'est réinjecté dans finalStats."
            : "Aucun Main Echo runtime n'est promu pour ce preset.",
          "Les nodes permanents du personnage, passifs d’arme et mécaniques de kit non structurées restent explicitement non résolus à ce checkpoint.",
          ...(promotedCommunityPreset
            ? [
                promotedCommunityPreset.promotionStatus === "verified"
                  ? `Echo loadout communautaire vérifié : ${promotedCommunityPreset.name} (${promotedCommunityPreset.author}), source pin ${promotedCommunityPreset.sourceBlobSha}.`
                  : `Echo loadout WUWA LAB curated-balanced : ${promotedCommunityPreset.name}. ${promotedCommunityPreset.promotionNote}`,
                "Les identités Echo/Sonata et chaque roll passent les resolvers locaux avant d’atteindre le calculateur.",
              ]
            : [
                communityPreset
                  ? "Un preset Echo reste archivé mais bloqué : il ne passe pas encore les contraintes locales vérifiées."
                  : "Aucun preset Echo n’est disponible pour ce personnage.",
              ]),
        ],
        source: baselineSource,
      } satisfies RecommendedBuildPreset;
    });
