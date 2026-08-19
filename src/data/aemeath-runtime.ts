import type { CombatEffect, Sonata, Weapon } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  aemeath as baseAemeath,
  aemeathPreset,
  aemeathGameSource,
  everbrightPolestar as baseEverbrightPolestar,
  sigillum,
  trailblazingStar as baseTrailblazingStar,
} from "./aemeath";

const source = (
  id: string,
  type: EffectDefinition["source"]["type"] = "resonator",
) => ({ id, type, label: id, metadata: aemeathGameSource });
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
  source: aemeathGameSource,
});

const sequenceRuntime: EffectDefinition = {
  id: "aemeath-sequence-personal-runtime",
  label: "Aemeath Sequence personal runtime",
  source: source("aemeath-sequence", "resonance-chain"),
  target: "self",
  activationPolicy: "initially-active",
  rules: [
    {
      id: "aemeath-s2-seraphic-mv",
      label: "S2 Seraphic Duet multiplier +100%",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [
        {
          kind: "action-id",
          anyOf: ["seraphic-encore", "seraphic-overture"],
        },
      ],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "constant", value: 100 },
        },
      ],
    },
    {
      id: "aemeath-s3-overdrive-mv",
      label: "S3 Overdrive multiplier +40%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["overdrive"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "constant", value: 40 },
        },
      ],
    },
    {
      id: "aemeath-s3-finale-mv",
      label: "S3 Finale multiplier +100%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["finale"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: { kind: "constant", value: 100 },
        },
      ],
    },
    {
      id: "aemeath-s6-liberation-amplification",
      label: "S6 target Liberation vulnerability",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [
        { kind: "damage-type", anyOf: ["resonanceLiberation"] },
      ],
      modifiers: [
        { kind: "damage-amplification", stacking: "additive", value: 40 },
      ],
    },
    {
      id: "aemeath-s6-tune-fixed-crit",
      label: "S6 Tune Rupture fixed Crit",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [
        {
          kind: "action-id",
          anyOf: ["starburst", "seraphic-bonus"],
        },
      ],
      modifiers: [
        {
          kind: "fixed-crit-override",
          stacking: "override",
          critRatePercent: 80,
          critDamagePercent: 275,
        },
      ],
    },
  ],
};

const s4TeamSelf: EffectDefinition = {
  id: "aemeath-s4-all-attribute-self",
  label: "S4 Ethereal Waltz — self All-Attribute DMG",
  source: source("aemeath-sequence", "resonance-chain"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "aemeath-s4-fusion",
      label: "+20% Fusion DMG",
      accounting: "runtime",
      requiredSequence: 4,
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 20 },
      ],
    },
  ],
  triggers: [
    {
      id: "aemeath-s4-casts",
      event: "action-start",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [
            "intro-normal",
            "intro-mech",
            "armament-merge",
            "call-of-dawn",
            "seraphic-encore",
            "seraphic-overture",
          ],
        },
      ],
      operations: [
        { kind: "activate-effect", effectId: "aemeath-s4-all-attribute-self" },
      ],
    },
  ],
};

const everbrightRuntime: EffectDefinition = {
  id: "everbright-r1-liberation-runtime",
  label: "Everbright Polestar R1 — Polestar",
  source: source("everbright-polestar", "weapon"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 8 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "everbright-lib-def-ignore",
      label: "Liberation DEF Ignore 32%",
      accounting: "runtime",
      selectors: [
        { kind: "damage-type", anyOf: ["resonanceLiberation"] },
      ],
      modifiers: [
        { kind: "defense-ignore", stacking: "additive", value: 0.32 },
      ],
    },
    {
      id: "everbright-fusion-res-ignore",
      label: "Fusion RES Ignore 10%",
      accounting: "runtime",
      modifiers: [
        { kind: "resistance-ignore", stacking: "additive", value: 0.1 },
      ],
    },
  ],
  triggers: [
    {
      id: "everbright-tune",
      event: "tune-rupture",
      operations: [
        { kind: "activate-effect", effectId: "everbright-r1-liberation-runtime" },
      ],
    },
    {
      id: "everbright-fusion",
      event: "fusion-burst",
      operations: [
        { kind: "activate-effect", effectId: "everbright-r1-liberation-runtime" },
      ],
    },
  ],
};

export const everbrightPolestar: Weapon = {
  ...baseEverbrightPolestar,
  effects: [
    ...(baseEverbrightPolestar.effects ?? []).filter(
      (effect) => effect.id !== "everbright-r1-liberation",
    ),
    wrap(
      everbrightRuntime,
      "Tune Rupture - Shifting or Fusion Burst activates the 8s DEF/RES ignore window.",
    ),
  ],
};

const trailblazingRuntime: EffectDefinition = {
  id: "trailblazing-5pc-runtime",
  label: "Trailblazing Star 5-piece",
  source: source("trailblazing-star", "sonata"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 8 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "trailblazing-crit",
      label: "+20% Crit Rate",
      accounting: "runtime",
      modifiers: [
        { kind: "crit-rate-bonus", stacking: "additive", value: 20 },
      ],
    },
    {
      id: "trailblazing-fusion",
      label: "+20% Fusion DMG",
      accounting: "runtime",
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 20 },
      ],
    },
  ],
  triggers: [
    {
      id: "trailblazing-tune",
      event: "tune-rupture",
      operations: [
        { kind: "activate-effect", effectId: "trailblazing-5pc-runtime" },
      ],
    },
    {
      id: "trailblazing-fusion",
      event: "fusion-burst",
      operations: [
        { kind: "activate-effect", effectId: "trailblazing-5pc-runtime" },
      ],
    },
  ],
};

export const trailblazingStar: Sonata = {
  ...baseTrailblazingStar,
  effects: [
    ...(baseTrailblazingStar.effects ?? []).filter(
      (effect) => effect.id !== "trailblazing-5pc",
    ),
    wrap(
      trailblazingRuntime,
      "Mode application activates +20% Crit Rate and +20% Fusion DMG for 8s.",
    ),
  ],
};

export const aemeathEffects: readonly CombatEffect[] = [
  ...(baseAemeath.combat?.effects ?? []),
  wrap(sequenceRuntime, "Sequence-gated personal multiplier rules."),
  wrap(s4TeamSelf, "S4 team All-Attribute bonus also affects Aemeath herself."),
];

export const aemeath = {
  ...baseAemeath,
  combat: baseAemeath.combat
    ? { ...baseAemeath.combat, effects: aemeathEffects }
    : undefined,
};

export {
  aemeathGameSource,
  aemeathPreset,
  sigillum,
};
