import type { CombatEffect } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  aemeath as runtimeAemeath,
  aemeathGameSource,
  aemeathPreset,
  everbrightPolestar,
  sigillum,
  trailblazingStar,
} from "./aemeath-runtime";

const source = {
  id: "aemeath-between-stars",
  type: "resonator" as const,
  label: "Between the Stars",
  metadata: aemeathGameSource,
};

const betweenStarsPersonal: EffectDefinition = {
  id: "aemeath-between-stars-personal-runtime",
  label: "Between the Stars · personal contribution",
  source,
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "between-stars-tune-own-contributor",
      label: "Tune Rupture · own contributor +20% Crit DMG",
      accounting: "runtime",
      selectors: [{ kind: "resonance-mode", anyOf: ["tune-rupture"] }],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 20 },
      ],
    },
    {
      id: "between-stars-fusion-own-contributor",
      label: "Fusion Burst · own contributor +30% Crit DMG",
      accounting: "runtime",
      selectors: [{ kind: "resonance-mode", anyOf: ["fusion-burst"] }],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 30 },
      ],
    },
    {
      id: "between-stars-s3-replacement",
      label: "S3 replacement · +60% Crit DMG",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [
        { kind: "resonance-mode", anyOf: ["tune-rupture", "fusion-burst"] },
      ],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 60 },
      ],
    },
    {
      id: "between-stars-s3-finale",
      label: "S3 replacement · Finale +25% DMG Amplification",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [
        { kind: "action-id", anyOf: ["finale"] },
        { kind: "resonance-mode", anyOf: ["tune-rupture", "fusion-burst"] },
      ],
      modifiers: [
        { kind: "damage-amplification", stacking: "additive", value: 25 },
      ],
    },
  ],
  triggers: [
    {
      id: "between-stars-own-tune-contribution",
      event: "tune-rupture",
      operations: [
        { kind: "activate-effect", effectId: "aemeath-between-stars-personal-runtime" },
      ],
    },
    {
      id: "between-stars-own-fusion-contribution",
      event: "fusion-burst",
      operations: [
        { kind: "activate-effect", effectId: "aemeath-between-stars-personal-runtime" },
      ],
    },
  ],
};

const betweenStarsLegacy: CombatEffect = {
  id: betweenStarsPersonal.id,
  name: betweenStarsPersonal.label,
  sourceId: source.id,
  trigger: "Aemeath contributes a Tune Rupture or Fusion Burst event",
  target: "self",
  effect:
    "Personal Combat counts only Aemeath's own contributor. Team-member contributor stacks remain a Team Engine responsibility. S3 replacement is deterministic after Aemeath's contribution.",
  structuredEffect: betweenStarsPersonal,
  source: aemeathGameSource,
};

const combatEffects: readonly CombatEffect[] = [
  ...(runtimeAemeath.combat?.effects ?? []),
  betweenStarsLegacy,
];

export const aemeath = {
  ...runtimeAemeath,
  combat: runtimeAemeath.combat
    ? {
        ...runtimeAemeath.combat,
        effects: combatEffects,
      }
    : undefined,
};

export {
  aemeathGameSource,
  aemeathPreset,
  everbrightPolestar,
  sigillum,
  trailblazingStar,
};
