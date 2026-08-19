import type { CombatAction, CombatEffect, Sonata, Weapon } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  fallacyOfNoReturn,
  rejuvenatingGlow as baseRejuvenatingGlow,
  variation as baseVariation,
  verina as baseVerina,
  verinaActions as baseActions,
  verinaPreset,
  verinaSource,
} from "./verina";

const unknown = () => ({ value: null, confidence: "unknown" as const });
const basic = (
  id: string,
  name: string,
  damageType: CombatAction["damageType"],
  multipliers: CombatAction["multipliers"],
  extra: Partial<CombatAction> = {},
): CombatAction => ({
  id,
  name,
  talent: "basicAttack",
  damageType,
  level: 10,
  multipliers,
  castDurationSeconds: unknown(),
  recoverySeconds: unknown(),
  hitTimingsSeconds: unknown(),
  source: verinaSource,
  ...extra,
});

const correctedBasic5 = basic(
  "verina-basic-5",
  "Cultivation: Basic Attack Stage 5",
  "basicAttack",
  [{ percent: 71.62, hits: 1 }],
  {
    resourceOperations: [
      {
        resourceId: "photosynthesis-energy",
        operation: "gain",
        amount: 1,
        stage: "after-action",
      },
    ],
  },
);

export const verinaActions: readonly CombatAction[] = [
  basic("verina-basic-1", "Cultivation: Basic Attack Stage 1", "basicAttack", [{ percent: 37.86, hits: 1 }]),
  basic("verina-basic-2", "Cultivation: Basic Attack Stage 2", "basicAttack", [{ percent: 51.16, hits: 1 }]),
  basic("verina-basic-3", "Cultivation: Basic Attack Stage 3", "basicAttack", [{ percent: 25.58, hits: 2 }]),
  basic("verina-basic-4", "Cultivation: Basic Attack Stage 4", "basicAttack", [{ percent: 67.32, hits: 1 }]),
  correctedBasic5,
  basic("verina-heavy", "Cultivation: Heavy Attack", "heavyAttack", [{ percent: 99.41, hits: 1 }], { costs: [{ resource: "stamina", amount: 20 }] }),
  basic("verina-midair-1", "Cultivation: Mid-air Attack Stage 1", "basicAttack", [{ percent: 56.37, hits: 1 }]),
  basic("verina-midair-2", "Cultivation: Mid-air Attack Stage 2", "basicAttack", [{ percent: 53.19, hits: 1 }]),
  basic("verina-midair-3", "Cultivation: Mid-air Attack Stage 3", "basicAttack", [{ percent: 25.42, hits: 3 }]),
  basic("verina-midair-heavy", "Cultivation: Mid-air Heavy Attack", "heavyAttack", [{ percent: 61.64, hits: 1 }]),
  basic("verina-dodge", "Cultivation: Dodge Counter", "basicAttack", [{ percent: 129.23, hits: 1 }]),
  ...baseActions.filter((action) => action.id !== "verina-basic-5"),
];

const source = (
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

const personalHealingBuff: EffectDefinition = {
  id: "verina-gift-of-nature-self",
  label: "Gift of Nature — personal ATK",
  source: source("verina"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 20 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "gift-atk",
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
      id: "gift-heal-actions",
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
      operations: [{ kind: "activate-effect", effectId: "verina-gift-of-nature-self" }],
    },
  ],
};

const sequenceEffects: readonly EffectDefinition[] = [
  {
    id: "verina-s4-spectro",
    label: "S4 Blossoming Embrace",
    source: source("verina-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 24 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "s4-spectro",
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
        id: "s4-actions",
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
        operations: [{ kind: "activate-effect", effectId: "verina-s4-spectro" }],
      },
    ],
  },
  {
    id: "verina-s6-joyous-harvest",
    label: "S6 Joyous Harvest",
    source: source("verina-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: "s6-starflower-mv",
        label: "+20% Starflower damage multiplier",
        accounting: "runtime",
        requiredSequence: 6,
        selectors: [
          {
            kind: "action-id",
            anyOf: ["verina-starflower-heavy", "verina-starflower-midair"],
          },
        ],
        modifiers: [
          {
            kind: "motion-value",
            mode: "relative-additive",
            stacking: "additive",
            value: { kind: "constant", value: 20 },
          },
        ],
      },
    ],
    triggers: [
      {
        id: "s6-starflower-coordinate",
        event: "action-start",
        predicates: [
          { kind: "has-effect", id: "verina-s6-joyous-harvest" },
          {
            kind: "identity",
            field: "actionId",
            anyOf: ["verina-starflower-heavy", "verina-starflower-midair"],
          },
        ],
        operations: [
          {
            kind: "emit-action",
            action: {
              actionId: "verina-coordinated-attack",
              attribution: "coordinated",
              snapshot: { stats: "hit", stacks: "tick" },
            },
          },
        ],
      },
    ],
  },
];

export const verinaEffects: readonly CombatEffect[] = [
  ...(baseVerina.combat?.effects ?? []),
  wrap(personalHealingBuff, "Relevant personal healing grants Verina +20% ATK for 20s."),
  ...sequenceEffects.map((definition) =>
    wrap(definition, "Sequence-gated personal runtime effect."),
  ),
];

const variationEffect: EffectDefinition = {
  id: "variation-r1-runtime",
  label: "Variation R1 — Concerto",
  source: source("variation", "weapon"),
  target: "self",
  activationPolicy: "triggered",
  rules: [],
  triggers: [
    {
      id: "variation-skill",
      event: "action-start",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: ["verina-botany-experiment"],
        },
      ],
      cooldown: { seconds: 20, scope: "owner" },
      operations: [
        {
          kind: "resource",
          operation: "gain",
          resourceId: "concerto",
          amount: { kind: "constant", value: 8 },
        },
      ],
    },
  ],
};

export const variation: Weapon = {
  ...baseVariation,
  effects: [
    ...(baseVariation.effects ?? []).filter((effect) => effect.id !== "variation-r1"),
    wrap(variationEffect, "Casting Resonance Skill grants 8 Concerto, 20s cooldown."),
  ],
};

const rejuvenatingSelf: EffectDefinition = {
  id: "rejuvenating-glow-5pc-self",
  label: "Rejuvenating Glow 5-piece — personal ATK",
  source: source("rejuvenating-glow", "sonata"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "rejuvenating-atk",
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
      id: "rejuvenating-heal",
      event: "action-end",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [
            "verina-starflower-heavy",
            "verina-arboreal-flourish",
          ],
        },
      ],
      operations: [
        { kind: "activate-effect", effectId: "rejuvenating-glow-5pc-self" },
      ],
    },
  ],
};

export const rejuvenatingGlow: Sonata = {
  ...baseRejuvenatingGlow,
  effects: [
    ...(baseRejuvenatingGlow.effects ?? []),
    wrap(rejuvenatingSelf, "After healing, Verina also receives the 5-piece +15% ATK for 30s."),
  ],
};

export const verina = {
  ...baseVerina,
  combat: baseVerina.combat
    ? {
        ...baseVerina.combat,
        actions: verinaActions,
        effects: verinaEffects,
      }
    : undefined,
};

export { fallacyOfNoReturn, verinaPreset, verinaSource };
