import type { CombatEffect, Sonata, Weapon } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  chisa as baseChisa,
  chisaActions,
  chisaPreset,
  chisaSource,
  kumokiri as baseKumokiri,
  threadOfSeveredFate as baseThreadOfSeveredFate,
  threnodianLeviathan,
} from "./chisa";

const source = (
  id: string,
  type: EffectDefinition["source"]["type"] = "resonator",
) => ({ id, type, label: id, metadata: chisaSource });

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
  source: chisaSource,
});

const sequenceRuntime: readonly EffectDefinition[] = [
  {
    id: "chisa-s1-snare-atk",
    label: "S1 Unseen Snare ATK",
    source: source("chisa-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 15 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "s1-atk",
        label: "+30% ATK",
        accounting: "runtime",
        requiredSequence: 1,
        modifiers: [
          {
            kind: "runtime-stat",
            stat: "attack",
            mode: "percent",
            stacking: "additive",
            value: { kind: "constant", value: 30 },
          },
        ],
      },
    ],
    triggers: [
      {
        id: "s1-snare",
        event: "status-applied",
        predicates: [{ kind: "target-has-status", id: "unseen-snare" }],
        operations: [{ kind: "activate-effect", effectId: "chisa-s1-snare-atk" }],
      },
    ],
  },
  {
    id: "chisa-s6-finality-personal",
    label: "S6 Unseen Snare - Finality",
    source: source("chisa-sequence", "resonance-chain"),
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 30 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [
      {
        id: "s6-chisa-amplification",
        label: "+40% Chisa damage",
        accounting: "runtime",
        requiredSequence: 6,
        modifiers: [
          { kind: "damage-amplification", stacking: "additive", value: 40 },
        ],
      },
    ],
    triggers: [
      {
        id: "s6-snare",
        event: "status-applied",
        predicates: [{ kind: "target-has-status", id: "unseen-snare" }],
        operations: [
          { kind: "activate-effect", effectId: "chisa-s6-finality-personal" },
        ],
      },
    ],
  },
];

const kumokiriDefinition: EffectDefinition = {
  id: "kumokiri-r1-runtime",
  label: "Kumokiri R1 — Liberation stacks",
  source: source("kumokiri", "weapon"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [
    {
      id: "kumokiri-liberation",
      label: "+8% Liberation DMG per stack",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [
        { kind: "damage-type-bonus", stacking: "additive", valuePerStack: 8, maxStacks: 3 },
      ],
    },
  ],
  triggers: [
    {
      id: "kumokiri-intro",
      event: "action-start",
      predicates: [
        { kind: "identity", field: "actionId", anyOf: ["chisa-intro"] },
      ],
      operations: [
        { kind: "activate-effect", effectId: "kumokiri-r1-runtime" },
        {
          kind: "gain-stacks",
          effectId: "kumokiri-r1-runtime",
          amount: { kind: "constant", value: 1 },
        },
      ],
    },
    {
      id: "kumokiri-negative-status",
      event: "status-applied",
      predicates: [
        {
          kind: "or",
          predicates: [
            { kind: "target-has-status", id: "unseen-snare" },
            { kind: "target-has-status", id: "havoc-bane" },
          ],
        },
      ],
      operations: [
        { kind: "activate-effect", effectId: "kumokiri-r1-runtime" },
        {
          kind: "gain-stacks",
          effectId: "kumokiri-r1-runtime",
          amount: { kind: "constant", value: 1 },
        },
      ],
    },
  ],
};

export const kumokiri: Weapon = {
  ...baseKumokiri,
  effects: [
    ...(baseKumokiri.effects ?? []).filter((effect) => effect.id !== "kumokiri-r1"),
    wrap(kumokiriDefinition, "Intro or Negative Status grants one +8% Liberation stack, max 3 for 15s."),
  ],
};

const threadDefinition: EffectDefinition = {
  id: "thread-severed-fate-runtime",
  label: "Thread of Severed Fate",
  source: source("thread-of-severed-fate", "sonata"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 5 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "thread-atk",
      label: "ATK +20%",
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
    {
      id: "thread-liberation",
      label: "Liberation DMG +30%",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [
        { kind: "damage-type-bonus", stacking: "additive", value: 30 },
      ],
    },
  ],
  triggers: [
    {
      id: "thread-havoc-bane",
      event: "status-applied",
      predicates: [{ kind: "target-has-status", id: "havoc-bane" }],
      operations: [
        { kind: "activate-effect", effectId: "thread-severed-fate-runtime" },
      ],
    },
  ],
};

export const threadOfSeveredFate: Sonata = {
  ...baseThreadOfSeveredFate,
  effects: [
    ...(baseThreadOfSeveredFate.effects ?? []).filter(
      (effect) => effect.id !== "thread-severed-fate",
    ),
    wrap(threadDefinition, "Inflicting Havoc Bane grants +20% ATK and +30% Liberation DMG for 5s."),
  ],
};

export const chisaEffects: readonly CombatEffect[] = [
  ...(baseChisa.combat?.effects ?? []),
  ...sequenceRuntime.map((definition) =>
    wrap(definition, "Sequence-gated personal runtime effect."),
  ),
];

export const chisa = {
  ...baseChisa,
  combat: baseChisa.combat
    ? { ...baseChisa.combat, effects: chisaEffects }
    : undefined,
};

export {
  chisaActions,
  chisaPreset,
  chisaSource,
  threnodianLeviathan,
};
