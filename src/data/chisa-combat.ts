import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { generatedReviewedCharacterGameDatabaseCombat } from "@/generated/reviewed-character-game-database-combat";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import type { CombatEffect } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import { applyReviewedGameDatabaseTalentLevels } from "./reviewed-game-database-combat";
import {
  chisa as runtimeChisa,
  chisaEffects as runtimeEffects,
  chisaPreset as runtimeChisaPreset,
  chisaSource,
  kumokiri,
  threadOfSeveredFate,
  threnodianLeviathan,
} from "./chisa-runtime";

const patchStructuredEffect = (definition: EffectDefinition): EffectDefinition => {
  if (definition.id === "chisa-woven-myriad") {
    return {
      ...definition,
      triggers: definition.triggers?.map((trigger) =>
        trigger.id === "woven-exit"
          ? { ...trigger, event: "action-end" as const }
          : trigger,
      ),
    };
  }

  if (definition.id === "chisa-eradication-ring-lv10") {
    return {
      ...definition,
      activationPolicy: "initially-active",
    };
  }

  return definition;
};

const patchEffect = (effect: CombatEffect): CombatEffect =>
  effect.structuredEffect
    ? { ...effect, structuredEffect: patchStructuredEffect(effect.structuredEffect) }
    : effect;

/**
 * Final personal-runtime projection for Chisa.
 * - Woven Myriad remains active through Sawring - Eradication damage and ends at action-end.
 * - The Ring Lv10 rule is always present; its resource expression still resolves to zero
 *   when no Ring is available, so the scenario does not need a character branch.
 * - Exact Lv1-Lv10 character talent multipliers come from the shared reviewed GameDatabase projection.
 */
export const chisaEffects: readonly CombatEffect[] = runtimeEffects.map(patchEffect);

const patchedRuntimeChisa = {
  ...runtimeChisa,
  combat: runtimeChisa.combat
    ? {
        ...runtimeChisa.combat,
        effects: chisaEffects,
      }
    : undefined,
};

export const chisa = applyReviewedGameDatabaseTalentLevels(
  patchedRuntimeChisa,
  generatedReviewedCharacterGameDatabaseCombat.chisa,
);

export const chisaActions = chisa.combat?.actions ?? [];

const generatedEcho = generatedCommunityEchoPresets10R1.chisa.echoLoadout;
const baseline = generatedCharacterBoxRosterBaselines10R1.chisa;
const chisaBaseStatBasis = {
  hp: 10775,
  attack: 437.5 + 500,
  defense: 1136.65,
};
const withEchoes = applyEchoLoadoutStatsV1(
  baseline,
  chisaBaseStatBasis,
  generatedEcho,
).finalStats;
const chisaFinalStats = {
  ...withEchoes,
  attack: withEchoes.attack + chisaBaseStatBasis.attack * 0.24,
  critRate: withEchoes.critRate + 8,
};

export const chisaPreset = {
  ...runtimeChisaPreset,
  id: "chisa-s0-l90-kumokiri-thread-mixed",
  label: "Chisa S0 Lv90 · Kumokiri · Thread / Havoc mixed",
  progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
  finalStats: chisaFinalStats,
  echoLoadout: generatedEcho,
  sonataId: "thread-of-severed-fate",
  mainEchoId: "reminiscence-threnodian-leviathan",
  notes: [
    "Permanent panel stats are derived from the exact Lv90 Chisa + Kumokiri baseline and the validated five-Echo loadout exactly once.",
    "The panel includes Chisa's +8% Crit Rate / +12% ATK minor Fortes and Kumokiri R1's permanent +12% ATK exactly once.",
    "The mixed Havoc Eclipse 2-piece +10% Havoc, the three-piece Thread of Severed Fate trigger and Threnodian Leviathan main-slot bonuses are resolved as runtime equipment effects and are not baked into finalStats.",
    "Personal timing uses the shared theoretical WUWA LAB profile policy.",
  ],
};

export {
  chisaSource,
  kumokiri,
  threadOfSeveredFate,
  threnodianLeviathan,
};
