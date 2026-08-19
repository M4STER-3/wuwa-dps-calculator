import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatEffect, Resonator } from "@/domain/models";

/**
 * Personal Combat loads executable structured definitions through their runtime
 * rules. Pure state machines, counters and short-lived markers can legitimately
 * have lifecycle/triggers without contributing a damage modifier themselves.
 *
 * Precise-DPS data passes through this adapter so those state-only definitions get
 * a no-op runtime anchor. This applies to both initially-active counters and
 * triggered markers, keeping the core runner generic and letting future kits add
 * state machines without character-specific bootstrap branches.
 */
function withRuntimeAnchor(definition: EffectDefinition): EffectDefinition {
  if (
    definition.rules.some((rule) => rule.accounting === "runtime") ||
    (!definition.lifecycle && !(definition.triggers?.length))
  ) {
    return definition;
  }
  return {
    ...definition,
    rules: [
      ...definition.rules,
      {
        id: `precise-state-anchor:${definition.id}`,
        label: `${definition.label} · state anchor`,
        accounting: "runtime",
        modifiers: [],
      },
    ],
  };
}

function patchEffect(effect: CombatEffect): CombatEffect {
  if (!effect.structuredEffect) return effect;
  const structuredEffect = withRuntimeAnchor(effect.structuredEffect);
  return structuredEffect === effect.structuredEffect
    ? effect
    : { ...effect, structuredEffect, effect: structuredEffect.label };
}

export function applyPreciseInitialStateAnchors(resonator: Resonator): Resonator {
  if (!resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: resonator.combat.effects.map(patchEffect),
    },
  };
}
