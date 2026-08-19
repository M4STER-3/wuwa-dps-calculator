import type { CombatEffect } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  chisa as runtimeChisa,
  chisaActions,
  chisaEffects as runtimeEffects,
  chisaPreset,
  chisaSource,
  kumokiri,
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

/**
 * Final personal-runtime projection for Chisa.
 * - Woven Myriad remains active through Sawring - Eradication damage and ends at action-end.
 * - The Ring Lv10 rule is always present; its resource expression still resolves to zero
 *   when no Ring is available, so the scenario does not need a character branch.
 */
export const chisaEffects: readonly CombatEffect[] = runtimeEffects.map(patchEffect);

export const chisa = {
  ...runtimeChisa,
  combat: runtimeChisa.combat
    ? {
        ...runtimeChisa.combat,
        effects: chisaEffects,
      }
    : undefined,
};

export {
  chisaActions,
  chisaPreset,
  chisaSource,
  kumokiri,
  threadOfSeveredFate,
  threnodianLeviathan,
};
