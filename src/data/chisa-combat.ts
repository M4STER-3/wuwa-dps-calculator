import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { generatedReviewedCharacterGameDatabaseCombat } from "@/generated/reviewed-character-game-database-combat";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import type { CombatEffect, Weapon } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import { applyReviewedGameDatabaseTalentLevels } from "./reviewed-game-database-combat";
import {
  chisa as runtimeChisa,
  chisaEffects as runtimeEffects,
  chisaPreset as runtimeChisaPreset,
  chisaSource,
  kumokiri as runtimeKumokiri,
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

const kumokiriAllAttributeDefinition: EffectDefinition = {
  id: "kumokiri-r1-max-stacks-all-attribute",
  label: "Kumokiri R1 — max-stack Negative Status bonus",
  source: {
    id: "kumokiri",
    type: "weapon",
    label: "Kumokiri",
    metadata: chisaSource,
  },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "kumokiri-r1-all-attribute",
      label: "+24% All-Attribute DMG",
      accounting: "runtime",
      modifiers: [
        { kind: "all-damage-bonus", stacking: "additive", value: 24 },
      ],
    },
  ],
  triggers: [
    {
      id: "kumokiri-r1-max-stacks-negative-status",
      event: "status-applied",
      predicates: [
        { kind: "has-effect", id: "kumokiri-r1-runtime", minStacks: 3 },
        {
          kind: "or",
          predicates: [
            { kind: "target-has-status", id: "unseen-snare" },
            { kind: "target-has-status", id: "havoc-bane" },
          ],
        },
      ],
      operations: [
        {
          kind: "activate-effect",
          effectId: "kumokiri-r1-max-stacks-all-attribute",
        },
      ],
    },
  ],
};

const kumokiriAllAttributeEffect: CombatEffect = {
  id: kumokiriAllAttributeDefinition.id,
  name: kumokiriAllAttributeDefinition.label,
  sourceId: "kumokiri",
  trigger: "At 3 Kumokiri stacks, inflicting a Negative Status",
  target: "self",
  effect: "+24% All-Attribute DMG for 15s.",
  structuredEffect: kumokiriAllAttributeDefinition,
  source: chisaSource,
};

export const kumokiri: Weapon = {
  ...runtimeKumokiri,
  effects: [
    ...(runtimeKumokiri.effects ?? []).filter(
      (effect) => effect.id !== kumokiriAllAttributeDefinition.id,
    ),
    kumokiriAllAttributeEffect,
  ],
};

/**
 * Final personal-runtime projection for Chisa.
 * - Woven Myriad remains active through Sawring - Eradication damage and ends at action-end.
 * - The Ring Lv10 rule is always present; its resource expression still resolves to zero
 *   when no Ring is available, so the scenario does not need a character branch.
 * - Exact Lv1-Lv10 character talent multipliers come from the shared reviewed GameDatabase projection.
 * - Kumokiri's max-stack All-Attribute bonus is runtime-only and observes the shared live-effect-stack contract.
 */
export const chisaEffects: readonly CombatEffect[] = runtimeEffects.map(patchEffect);

const resolvedFinalUnknowns = new Set([
  "Heavy Attack Lv1 disputed.",
  "Basic-family Lv2-9 unavailable.",
]);

const patchedRuntimeChisa = {
  ...runtimeChisa,
  combat: runtimeChisa.combat
    ? {
        ...runtimeChisa.combat,
        effects: chisaEffects,
        unknowns: runtimeChisa.combat.unknowns.filter(
          (entry) => !resolvedFinalUnknowns.has(entry),
        ),
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
    "Kumokiri's three +8% Liberation stacks and its +24% All-Attribute max-stack bonus remain runtime-only and are never baked into finalStats.",
    "The mixed Havoc Eclipse 2-piece +10% Havoc, the three-piece Thread of Severed Fate trigger and Threnodian Leviathan main-slot bonuses are resolved as runtime equipment effects and are not baked into finalStats.",
    "Personal timing uses the shared theoretical WUWA LAB profile policy.",
  ],
};

export {
  chisaSource,
  threadOfSeveredFate,
  threnodianLeviathan,
};
