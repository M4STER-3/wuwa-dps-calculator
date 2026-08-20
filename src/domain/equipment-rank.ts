import type {
  EffectDefinition,
  EffectModifier,
  RuntimeStatModifier,
  MotionValueModifier,
  TriggerOperation,
  ValueExpression,
} from "./effect-models";
import type { CombatEffect, Weapon } from "./models";

export type WeaponRank = 1 | 2 | 3 | 4 | 5;

export function materializeRankExpression(expression: ValueExpression, rank: WeaponRank): ValueExpression {
  switch (expression.kind) {
    case "rank": {
      const value = expression.values[rank];
      if (value === undefined || !Number.isFinite(value)) {
        throw new Error(`Missing exact equipment value for rank ${rank}.`);
      }
      return { kind: "constant", value };
    }
    case "add":
    case "multiply":
    case "min":
    case "max":
      return { ...expression, values: expression.values.map((value) => materializeRankExpression(value, rank)) };
    case "subtract":
      return {
        ...expression,
        left: materializeRankExpression(expression.left, rank),
        right: materializeRankExpression(expression.right, rank),
      };
    case "clamp":
    case "cap":
      return { ...expression, value: materializeRankExpression(expression.value, rank) };
    case "stack-threshold":
      return {
        ...expression,
        then: materializeRankExpression(expression.then, rank),
        ...(expression.otherwise ? { otherwise: materializeRankExpression(expression.otherwise, rank) } : {}),
      };
    default:
      return expression;
  }
}

function materializeModifier(
  modifier: EffectDefinition["rules"][number]["modifiers"][number],
  rank: WeaponRank,
): EffectDefinition["rules"][number]["modifiers"][number] {
  if ("valueExpression" in modifier && modifier.valueExpression !== undefined) {
    return {
      ...(modifier as EffectModifier),
      valueExpression: materializeRankExpression(modifier.valueExpression, rank),
    };
  }
  if ((modifier.kind === "runtime-stat" || modifier.kind === "motion-value") && "value" in modifier) {
    return {
      ...(modifier as RuntimeStatModifier | MotionValueModifier),
      value: materializeRankExpression(modifier.value, rank),
    } as typeof modifier;
  }
  return modifier;
}

function materializeOperation(operation: TriggerOperation, rank: WeaponRank): TriggerOperation {
  if ((operation.kind === "gain-stacks" || operation.kind === "consume-stacks") && operation.amount !== "all") {
    return { ...operation, amount: materializeRankExpression(operation.amount, rank) };
  }
  if (operation.kind === "resource" && operation.amount) {
    return { ...operation, amount: materializeRankExpression(operation.amount, rank) };
  }
  if (operation.kind === "apply-status" && operation.stacks) {
    return { ...operation, stacks: materializeRankExpression(operation.stacks, rank) };
  }
  return operation;
}

export function materializeEffectForRank(definition: EffectDefinition, rank: WeaponRank): EffectDefinition {
  return {
    ...definition,
    rules: definition.rules.map((rule) => ({
      ...rule,
      modifiers: rule.modifiers.map((modifier) => materializeModifier(modifier, rank)),
    })),
    triggers: definition.triggers?.map((trigger) => ({
      ...trigger,
      operations: trigger.operations.map((operation) => materializeOperation(operation, rank)),
    })),
  };
}

function materializeCombatEffect(effect: CombatEffect, rank: WeaponRank): CombatEffect {
  return effect.structuredEffect
    ? { ...effect, structuredEffect: materializeEffectForRank(effect.structuredEffect, rank) }
    : effect;
}

export function materializeWeaponForRank(weapon: Weapon | undefined, rank: number): Weapon | undefined {
  if (!weapon) return undefined;
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) {
    throw new Error(`Invalid weapon rank ${rank}.`);
  }
  const exactRank = rank as WeaponRank;
  return {
    ...weapon,
    effects: weapon.effects?.map((effect) => materializeCombatEffect(effect, exactRank)),
  };
}
