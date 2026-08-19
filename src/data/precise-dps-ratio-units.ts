import type { EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatEffect, Weapon } from "@/domain/models";

type RatioModifierKind =
  | "defense-reduction"
  | "defense-ignore"
  | "resistance-reduction"
  | "resistance-ignore";

export interface RatioPercentRulePatch {
  effectId: string;
  ruleId: string;
  kind: RatioModifierKind;
}

function percentExpressionToRatio(expression: ValueExpression): ValueExpression {
  if (expression.kind === "constant") {
    return { ...expression, value: expression.value / 100 };
  }
  if (expression.kind === "rank") {
    return {
      ...expression,
      values: Object.fromEntries(
        Object.entries(expression.values).map(([rank, value]) => [rank, value / 100]),
      ),
    };
  }
  throw new Error(
    `Precise DPS ratio normalization only supports constant/rank percentage expressions, not ${expression.kind}.`,
  );
}

function patchDefinition(
  definition: EffectDefinition,
  patches: readonly RatioPercentRulePatch[],
): EffectDefinition {
  const relevant = patches.filter((patch) => patch.effectId === definition.id);
  if (!relevant.length) return definition;

  return {
    ...definition,
    rules: definition.rules.map((rule) => {
      const patch = relevant.find((candidate) => candidate.ruleId === rule.id);
      if (!patch) return rule;
      let matched = 0;
      const modifiers = rule.modifiers.map((modifier) => {
        if (modifier.kind !== patch.kind) return modifier;
        if (!("valueExpression" in modifier) || modifier.valueExpression === undefined) {
          throw new Error(
            `Precise DPS ratio patch ${definition.id}/${rule.id} requires valueExpression.`,
          );
        }
        matched += 1;
        return {
          ...modifier,
          valueExpression: percentExpressionToRatio(modifier.valueExpression),
        };
      });
      if (matched !== 1) {
        throw new Error(
          `Precise DPS ratio patch ${definition.id}/${rule.id} matched ${matched} ${patch.kind} modifiers.`,
        );
      }
      return { ...rule, modifiers };
    }),
  };
}

function patchCombatEffect(
  effect: CombatEffect,
  patches: readonly RatioPercentRulePatch[],
): CombatEffect {
  if (!effect.structuredEffect) return effect;
  const structuredEffect = patchDefinition(effect.structuredEffect, patches);
  return structuredEffect === effect.structuredEffect
    ? effect
    : { ...effect, structuredEffect };
}

/**
 * The Damage Engine intentionally stores DEF/RES reduction and ignore as 0..1 ratios,
 * while public game descriptions express them as percentage points. Exact data patches
 * must opt in explicitly so no broad heuristic silently changes already-normalized data.
 */
export function normalizeExplicitWeaponRatioPercentRules(
  weapon: Weapon,
  patches: readonly RatioPercentRulePatch[],
): Weapon {
  if (!patches.length) return weapon;
  const effects = weapon.effects?.map((effect) => patchCombatEffect(effect, patches));
  for (const patch of patches) {
    const definition = effects?.find(
      (effect) => effect.structuredEffect?.id === patch.effectId,
    )?.structuredEffect;
    if (!definition) {
      throw new Error(`Precise DPS ratio patch missing effect ${patch.effectId}.`);
    }
    if (!definition.rules.some((rule) => rule.id === patch.ruleId)) {
      throw new Error(
        `Precise DPS ratio patch missing rule ${patch.effectId}/${patch.ruleId}.`,
      );
    }
  }
  return { ...weapon, effects };
}
