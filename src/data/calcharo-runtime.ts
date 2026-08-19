import type { CombatEffect } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  calcharo as baseCalcharo,
  calcharoActions,
  calcharoPreset,
  calcharoSource,
  lustrousRazor,
  nightmareThunderingMephis,
  voidThunder,
} from "./calcharo";

const source = (id: string, type: EffectDefinition["source"]["type"]) => ({
  id,
  type,
  label: id,
  metadata: calcharoSource,
});

const sequencePersonal: EffectDefinition = {
  id: "calcharo-sequence-personal",
  label: "Calcharo Sequence personal effects",
  source: source("calcharo-sequence", "resonance-chain"),
  target: "self",
  activationPolicy: "initially-active",
  rules: [
    {
      id: "calcharo-s1-runtime-gate",
      label: "S1 runtime gate",
      accounting: "runtime",
      requiredSequence: 1,
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 0 }],
    },
    {
      id: "calcharo-s5-intro",
      label: "S5 Intro damage",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [
        {
          kind: "action-id",
          anyOf: ["calcharo-intro", "calcharo-necessary-means"],
        },
      ],
      modifiers: [
        { kind: "damage-amplification", stacking: "additive", value: 50 },
      ],
    },
  ],
  triggers: [
    {
      id: "calcharo-s1-energy",
      event: "action-hit",
      predicates: [
        { kind: "has-effect", id: "calcharo-sequence-personal" },
        {
          kind: "identity",
          field: "actionId",
          anyOf: ["calcharo-skill-1", "calcharo-skill-2", "calcharo-skill-3"],
        },
      ],
      cooldown: { seconds: 20, scope: "owner" },
      operations: [
        {
          kind: "resource",
          operation: "gain",
          resourceId: "resonance-energy",
          amount: { kind: "constant", value: 10 },
        },
      ],
    },
  ],
};

const s6Phantoms: EffectDefinition = {
  id: "calcharo-s6-phantoms",
  label: "S6 Death Messenger Phantoms",
  source: source("calcharo-sequence", "resonance-chain"),
  target: "self",
  activationPolicy: "initially-active",
  rules: [
    {
      id: "calcharo-s6-runtime-gate",
      label: "S6 runtime gate",
      accounting: "runtime",
      requiredSequence: 6,
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 0 }],
    },
  ],
  triggers: [
    {
      id: "calcharo-s6-death-messenger",
      event: "action-start",
      predicates: [
        { kind: "has-effect", id: "calcharo-s6-phantoms" },
        {
          kind: "identity",
          field: "actionId",
          anyOf: ["calcharo-death-messenger"],
        },
      ],
      operations: [
        {
          kind: "emit-action",
          action: {
            actionId: "calcharo-s6-phantom",
            attribution: "coordinated",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
        {
          kind: "emit-action",
          action: {
            actionId: "calcharo-s6-phantom",
            attribution: "coordinated",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
      ],
    },
  ],
};

const replacementById = new Map<string, EffectDefinition>([
  [sequencePersonal.id, sequencePersonal],
  [s6Phantoms.id, s6Phantoms],
]);

export const calcharoEffects: readonly CombatEffect[] = (
  baseCalcharo.combat?.effects ?? []
).map((effect) => {
  const replacement = replacementById.get(effect.id);
  return replacement ? { ...effect, structuredEffect: replacement } : effect;
});

export const calcharo = {
  ...baseCalcharo,
  combat: baseCalcharo.combat
    ? { ...baseCalcharo.combat, effects: calcharoEffects }
    : undefined,
};

export {
  calcharoActions,
  calcharoPreset,
  calcharoSource,
  lustrousRazor,
  nightmareThunderingMephis,
  voidThunder,
};
