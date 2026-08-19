import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatEffect, Resonator } from "@/domain/models";

/**
 * Personal Combat historically bootstraps only initially-active definitions that
 * expose at least one runtime rule. Pure state machines/counters can legitimately
 * be initially active without contributing a modifier themselves (for example a
 * stack counter whose triggers later activate another effect).
 *
 * Precise-DPS data passes through this adapter so those state-only definitions get
 * a no-op runtime anchor. This keeps the core runner generic and lets future kits
 * add counters without character-specific bootstrap branches.
 */
function withRuntimeAnchor(definition: EffectDefinition): EffectDefinition {
  if (
    definition.activationPolicy !== "initially-active" ||
    definition.rules.some((rule) => rule.accounting === "runtime") ||
    (!definition.lifecycle?.stacks && !(definition.triggers?.length))
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
