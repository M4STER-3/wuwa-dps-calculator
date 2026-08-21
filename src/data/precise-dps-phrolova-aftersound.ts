import type { EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatEffect, Resonator } from "@/domain/models";
import { PHROLOVA } from "./precise-dps-phrolova";

export const PHROLOVA_AFTERSOUND_CAP = 24;
export const PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP = 100;
export const PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID =
  "precise-phrolova-aftersound-overflow-crit";

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const resource = (resourceId: string): ValueExpression => ({ kind: "resource", resourceId });

/** Number of points from a gain that land beyond the 24-stack Aftersound cap. */
function overflowFromGain(gain: number): ValueExpression {
  return {
    kind: "max",
    values: [
      constant(0),
      {
        kind: "subtract",
        left: { kind: "add", values: [resource("aftersound"), constant(gain)] },
        right: constant(PHROLOVA_AFTERSOUND_CAP),
      },
    ],
  };
}

export const phrolovaAftersoundOverflowEffect: EffectDefinition = {
  id: PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID,
  label: "Octet · Aftersound overflow CRIT DMG",
  source: { id: "phrolova-octet", type: "resonator", label: "Octet" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "replace-existing",
    stacks: {
      kind: "shared",
      max: PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
      initial: 0,
    },
  },
  rules: [
    {
      id: "phrolova-aftersound-overflow-crit-dmg",
      label: "+1% CRIT DMG per Aftersound gained beyond 24, up to +100%",
      accounting: "runtime",
      modifiers: [
        {
          kind: "crit-damage-bonus",
          stacking: "additive",
          valuePerStack: 1,
          maxStacks: PHROLOVA_AFTERSOUND_OVERFLOW_CRIT_CAP,
        },
      ],
    },
  ],
};

const offFieldEnhancedAftersound: EffectDefinition = {
  id: "precise-phrolova-offfield-enhanced-aftersound",
  label: "Enhanced Hecate · off-field Aftersound gain",
  source: { id: "phrolova-hecate", type: "resonator", label: "Hecate" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "phrolova-offfield-enhanced-aftersound-gain",
      event: "damage-dealt",
      predicates: [
        {
          kind: "identity",
          field: "actionId",
          anyOf: [PHROLOVA.hecateStrings, PHROLOVA.hecateWinds, PHROLOVA.hecateCadenza],
        },
        { kind: "on-field", value: false },
      ],
      operations: [
        {
          kind: "gain-stacks",
          effectId: PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID,
          amount: overflowFromGain(1),
        },
        {
          kind: "resource",
          operation: "gain",
          resourceId: "aftersound",
          amount: constant(1),
        },
      ],
    },
  ],
};

const source = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Prydwen / WutheringTools · Phrolova Aftersound",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
};

const combatEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: "self",
  effect: structuredEffect.label,
  source,
  structuredEffect,
});

function addOverflowBeforeAftersoundGain(
  definition: EffectDefinition,
  triggerId: string,
  gain: number,
): EffectDefinition {
  return {
    ...definition,
    triggers: definition.triggers?.map((trigger) =>
      trigger.id !== triggerId
        ? trigger
        : {
            ...trigger,
            operations: [
              {
                kind: "gain-stacks" as const,
                effectId: PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID,
                amount: overflowFromGain(gain),
              },
              ...trigger.operations,
            ],
          },
    ),
  };
}

function patchEffect(effect: CombatEffect): CombatEffect {
  const structured = effect.structuredEffect;
  if (!structured) return effect;
  if (structured.id === "precise-phrolova-scarlet-coda") {
    const patched = addOverflowBeforeAftersoundGain(
      structured,
      "phrolova-s2-scarlet-grants-aftersound",
      14,
    );
    return { ...effect, structuredEffect: patched, effect: patched.label };
  }
  if (structured.id === "precise-phrolova-sequences") {
    const patched = addOverflowBeforeAftersoundGain(
      structured,
      "phrolova-s6-apparition-aftersound",
      8,
    );
    return { ...effect, structuredEffect: patched, effect: patched.label };
  }
  return effect;
}

export function applyPrecisePhrolovaAftersoundMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "phrolova" || !resonator.combat) return resonator;
  const effects = resonator.combat.effects.map(patchEffect);
  if (!effects.some((effect) => effect.structuredEffect?.id === PHROLOVA_AFTERSOUND_OVERFLOW_EFFECT_ID)) {
    effects.push(
      combatEffect(
        "phrolova-aftersound-overflow",
        "Aftersound overflow CRIT DMG",
        "Aftersound beyond 24",
        phrolovaAftersoundOverflowEffect,
      ),
      combatEffect(
        "phrolova-offfield-enhanced-aftersound",
        "Off-field Enhanced Hecate Aftersound",
        "Enhanced Hecate damage while off field",
        offFieldEnhancedAftersound,
      ),
    );
  }
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects,
      unknowns: resonator.combat.unknowns.filter(
        (note) => !note.includes("Aftersound beyond 24"),
      ),
    },
  };
}
