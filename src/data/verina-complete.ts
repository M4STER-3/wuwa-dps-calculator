import type {
  CombatAction,
  CombatEffect,
  MainEcho,
  RecommendedBuildPreset,
  Resonator,
  Sonata,
} from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  fallacyOfNoReturn as runtimeFallacyOfNoReturn,
  rejuvenatingGlow as runtimeRejuvenatingGlow,
  variation,
  verina as runtimeVerina,
  verinaPreset as baseVerinaPreset,
  verinaSource,
} from "./verina-runtime";

const effectSource = (
  id: string,
  type: EffectDefinition["source"]["type"] = "resonator",
) => ({ id, type, label: id, metadata: verinaSource });

const wrap = (definition: EffectDefinition, description: string): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.label,
  target:
    definition.target === "enemy"
      ? "enemy"
      : definition.target === "team"
        ? "team"
        : definition.target === "other-team-members"
          ? "other-team-members"
          : "self",
  effect: description,
  structuredEffect: definition,
  source: verinaSource,
});

const correctedMidair = (action: CombatAction): CombatAction =>
  action.id === "verina-starflower-midair"
    ? {
        ...action,
        outcomes: {
          target: "nearby-resonators",
          healingByTalentLevel: {
            10: { scalingAttribute: "attack", flat: 1188, percent: 29.75 },
          },
        },
      }
    : action;

export const verinaActions: readonly CombatAction[] =
  runtimeVerina.combat?.actions.map(correctedMidair) ?? [];

const giftOfNature: EffectDefinition = {
  id: "verina-gift-of-nature-team",
  label: "Gift of Nature — team ATK",
  source: effectSource("verina"),
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 20 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "gift-of-nature-atk",
      label: "+20% ATK",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: { kind: "constant", value: 20 },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "gift-of-nature-healing-actions",
      event: "action-end",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [
            "verina-starflower-heavy",
            "verina-starflower-midair",
            "verina-arboreal-flourish",
          ],
        },
      ],
      operations: [{ kind: "activate-effect", effectId: "verina-gift-of-nature-team" }],
    },
    {
      id: "gift-of-nature-outro",
      event: "outro",
      operations: [{ kind: "activate-effect", effectId: "verina-gift-of-nature-team" }],
    },
  ],
};

const s4BlossomingEmbrace: EffectDefinition = {
  id: "verina-s4-spectro-team",
  label: "S4 Blossoming Embrace — team Spectro DMG",
  source: effectSource("verina-sequence", "resonance-chain"),
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 24 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "s4-spectro-team",
      label: "+15% Spectro DMG",
      accounting: "runtime",
      requiredSequence: 4,
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 15 },
      ],
    },
  ],
  triggers: [
    {
      id: "s4-healing-actions",
      event: "action-end",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [
            "verina-starflower-heavy",
            "verina-starflower-midair",
            "verina-arboreal-flourish",
          ],
        },
      ],
      operations: [{ kind: "activate-effect", effectId: "verina-s4-spectro-team" }],
    },
    {
      id: "s4-outro",
      event: "outro",
      operations: [{ kind: "activate-effect", effectId: "verina-s4-spectro-team" }],
    },
  ],
};

const correctedResonatorEffects = [
  ...(runtimeVerina.combat?.effects ?? []).filter(
    (effect) =>
      effect.id !== "verina-gift-of-nature-self" &&
      effect.id !== "verina-s4-spectro",
  ),
  wrap(
    giftOfNature,
    "Heavy/Mid-air Starflower, Arboreal Flourish or Blossom grants all party members +20% ATK for 20s.",
  ),
  wrap(
    s4BlossomingEmbrace,
    "At S4+, Heavy/Mid-air Starflower, Arboreal Flourish or Blossom grants all party members +15% Spectro DMG for 24s.",
  ),
];

export const verina: Resonator = {
  ...runtimeVerina,
  combat: runtimeVerina.combat
    ? {
        ...runtimeVerina.combat,
        actions: verinaActions,
        effects: correctedResonatorEffects,
        unknowns: runtimeVerina.combat.unknowns.filter(
          (unknown) =>
            unknown !== "Mid-air Starflower exact outcomes." &&
            unknown !== "S6 event semantics.",
        ),
      }
    : undefined,
};

const rejuvenatingTeam: EffectDefinition = {
  id: "rejuvenating-glow-5pc-team",
  label: "Rejuvenating Glow 5-piece — team ATK",
  source: effectSource("rejuvenating-glow", "sonata"),
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "rejuvenating-team-atk",
      label: "+15% ATK",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: { kind: "constant", value: 15 },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "rejuvenating-healing-actions",
      event: "action-end",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [
            "verina-starflower-heavy",
            "verina-starflower-midair",
            "verina-arboreal-flourish",
            "verina-coordinated-attack",
          ],
        },
      ],
      operations: [{ kind: "activate-effect", effectId: "rejuvenating-glow-5pc-team" }],
    },
    {
      id: "rejuvenating-outro-heal",
      event: "outro",
      operations: [{ kind: "activate-effect", effectId: "rejuvenating-glow-5pc-team" }],
    },
  ],
};

export const rejuvenatingGlow: Sonata = {
  ...runtimeRejuvenatingGlow,
  effects: [
    ...(runtimeRejuvenatingGlow.effects ?? []).filter(
      (effect) => effect.id !== "rejuvenating-glow-5pc-self",
    ),
    wrap(
      rejuvenatingTeam,
      "Upon healing allies, all party members gain +15% ATK for 30s.",
    ),
  ],
};

const fallacyEnergyRegen: EffectDefinition = {
  id: "fallacy-energy-regen-self",
  label: "Fallacy of No Return — wielder Energy Regen",
  source: effectSource("fallacy-of-no-return", "echo"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 20 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "fallacy-energy-regen",
      label: "+10% Energy Regen",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "energyRegen",
          mode: "flat",
          stacking: "additive",
          value: { kind: "constant", value: 10 },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "fallacy-energy-regen-cast",
      event: "action-end",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["fallacy-blast"] },
      ],
      operations: [{ kind: "activate-effect", effectId: "fallacy-energy-regen-self" }],
    },
  ],
};

const fallacyTeamAttack: EffectDefinition = {
  id: "fallacy-team-atk",
  label: "Fallacy of No Return — team ATK",
  source: effectSource("fallacy-of-no-return", "echo"),
  target: "team",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 20 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "fallacy-team-atk",
      label: "+10% ATK",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: { kind: "constant", value: 10 },
        },
      ],
    },
  ],
  triggers: [
    {
      id: "fallacy-team-atk-cast",
      event: "action-end",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["fallacy-blast"] },
      ],
      operations: [{ kind: "activate-effect", effectId: "fallacy-team-atk" }],
    },
  ],
};

export const fallacyOfNoReturn: MainEcho = {
  ...runtimeFallacyOfNoReturn,
  effects: [
    wrap(
      fallacyEnergyRegen,
      "After casting Fallacy, the wielder gains +10% Energy Regen for 20s.",
    ),
    wrap(
      fallacyTeamAttack,
      "After casting Fallacy, all party members gain +10% ATK for 20s.",
    ),
  ],
};

const permanentAttackWithMinorForte =
  (337.5 + 337) * (1 + 12 / 100);

export const verinaPreset: RecommendedBuildPreset = {
  ...baseVerinaPreset,
  progression: {
    inherentSkillsUnlocked: true,
    minorFortesUnlocked: true,
  },
  finalStats: {
    ...baseVerinaPreset.finalStats,
    attack: permanentAttackWithMinorForte,
  },
  notes: [
    "Panel baseline includes the Lv90 character + Variation base ATK with Verina's permanent +12% ATK minor Forte exactly once.",
    "Variation's permanent Energy Regen, the +12% Healing Bonus minor Forte, and Rejuvenating Glow 2-piece +10% Healing Bonus are included in finalStats.",
    "Gift of Nature, Rejuvenating Glow 5-piece, Fallacy buffs, Sequence buffs, and other triggered effects remain runtime-only.",
  ],
};

export { variation, verinaSource };
