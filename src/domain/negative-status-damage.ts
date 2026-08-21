import {
  calculateDefenseMultiplier,
  calculateResistanceMultiplier,
  type DamageAmounts,
  type DamageTarget,
} from "./damage-engine";
import type { Element } from "./models";

export type NegativeStatusDamageKind = "fusionBurst" | "glacioChafe";

export interface NegativeStatusCritOverride {
  critRatePercent: number;
  critDamagePercent: number;
}

export interface NegativeStatusDamageRequest {
  kind: NegativeStatusDamageKind;
  attackerLevel: number;
  target: DamageTarget;
  stacks: number;
  /** Data-owned MV override in negative-status basis points (102% => 10200). */
  motionValueBasisPointsOverride?: number;
  /** Relative multiplier increase: 200 means ×(1 + 2.00). */
  multiplierIncreasePercent?: number;
  /** Negative Status DMG Amplification / Deepen in percentage points. */
  damageAmplificationPercent?: number;
  /** Generic total-damage increase in percentage points. */
  totalDamageBonusPercent?: number;
  defenseReduction?: number;
  resistanceReduction?: number;
  critOverride?: NegativeStatusCritOverride;
}

export interface NegativeStatusDamageResult {
  status: "supported";
  formula: "negative-status-v0.2";
  kind: NegativeStatusDamageKind;
  element: Element;
  attackerLevel: number;
  enemyLevel: number;
  stacks: number;
  levelConstant: number;
  motionValueBasisPoints: number;
  motionValueMultiplier: number;
  multiplierIncreasePercent: number;
  defenseReduction: number;
  defenseMultiplier: number;
  baseResistance: number;
  resistanceReduction: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  damageAmplificationPercent: number;
  damageAmplificationMultiplier: number;
  totalDamageBonusPercent: number;
  totalDamageBonusMultiplier: number;
  effectiveCritRate: number;
  critDamageMultiplier: number;
  expectedCritMultiplier: number;
  total: DamageAmounts;
}

const negativeStatusElement: Readonly<Record<NegativeStatusDamageKind, Element>> = {
  fusionBurst: "fusion",
  glacioChafe: "glacio",
};

const levelConstants: Readonly<Record<number, number>> = {
  1: 11,
  20: 24,
  40: 85,
  50: 229,
  60: 380,
  70: 1005,
  80: 2005,
  90: 3674,
  100: 4082,
};

/** Fusion Burst motion values in negative-status basis points. */
const fusionBurstMotionValueByStacks: Readonly<Record<number, number>> = {
  1: 8400,
  2: 15229,
  3: 22058,
  4: 28888,
  5: 35717,
  6: 42546,
  7: 49375,
  8: 56204,
  9: 63034,
  10: 69863,
  11: 93150,
  12: 116438,
  13: 139726,
};

/** Glacio Chafe / Glacio Bite motion values in negative-status basis points. */
const glacioChafeMotionValueByStacks: Readonly<Record<number, number>> = {
  1: 2450,
  2: 4442,
  3: 6434,
  4: 8426,
  5: 10417,
  6: 12409,
  7: 14401,
  8: 16393,
  9: 18385,
  10: 20377,
  11: 27169,
  12: 33961,
  13: 40753,
};

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function nonNegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) throw new Error(`${label} cannot be negative.`);
  return value;
}

export function negativeStatusLevelConstant(level: number): number | undefined {
  if (!Number.isInteger(level) || level <= 0) return undefined;
  return levelConstants[level];
}

export function fusionBurstMotionValue(stacks: number): number | undefined {
  if (!Number.isInteger(stacks) || stacks < 1 || stacks > 13) return undefined;
  return fusionBurstMotionValueByStacks[stacks];
}

export function glacioChafeMotionValue(stacks: number): number | undefined {
  if (!Number.isInteger(stacks) || stacks < 1 || stacks > 13) return undefined;
  return glacioChafeMotionValueByStacks[stacks];
}

function tableMotionValue(kind: NegativeStatusDamageKind, stacks: number): number | undefined {
  return kind === "fusionBurst"
    ? fusionBurstMotionValue(stacks)
    : glacioChafeMotionValue(stacks);
}

/**
 * Generic negative-status formula.
 *
 * It deliberately does not read ATK/HP/DEF, elemental bonus or standard damage
 * type bonus. The status is level-constant based. DEF Ignore and RES Ignore are
 * not accepted because this status family does not use them in the verified
 * formula. Character kits alter it through explicit stack/MV/multiplier/amp/crit
 * inputs owned by data, not through hard-coded Resonator branches.
 */
export function calculateNegativeStatusDamage(
  request: NegativeStatusDamageRequest,
): NegativeStatusDamageResult {
  const levelConstant = negativeStatusLevelConstant(request.attackerLevel);
  if (levelConstant === undefined) {
    throw new Error(
      `Negative Status level constant is not verified at level ${request.attackerLevel}.`,
    );
  }

  const motionValueBasisPoints = request.motionValueBasisPointsOverride === undefined
    ? tableMotionValue(request.kind, request.stacks)
    : nonNegative(request.motionValueBasisPointsOverride, "Negative Status MV override");
  if (motionValueBasisPoints === undefined || motionValueBasisPoints <= 0) {
    throw new Error(
      `${request.kind} stacks ${request.stacks} are outside the verified table.`,
    );
  }

  const multiplierIncreasePercent = nonNegative(
    request.multiplierIncreasePercent ?? 0,
    "Negative Status multiplier increase",
  );
  const damageAmplificationPercent = nonNegative(
    request.damageAmplificationPercent ?? 0,
    "Negative Status amplification",
  );
  const totalDamageBonusPercent = nonNegative(
    request.totalDamageBonusPercent ?? 0,
    "Negative Status total damage bonus",
  );
  const defenseReduction = nonNegative(
    request.defenseReduction ?? 0,
    "Negative Status DEF reduction",
  );
  if (defenseReduction > 1) {
    throw new Error("Negative Status DEF reduction must be a ratio between 0 and 1.");
  }
  const resistanceReduction = nonNegative(
    request.resistanceReduction ?? 0,
    "Negative Status RES reduction",
  );

  const element = negativeStatusElement[request.kind];
  const baseResistance = request.target.elementalResistance[element] ?? 0;
  finite(baseResistance, "Negative Status base resistance");
  const effectiveResistance = baseResistance - resistanceReduction;
  const resistanceMultiplier = calculateResistanceMultiplier(effectiveResistance);
  const defenseMultiplier = calculateDefenseMultiplier(
    request.attackerLevel,
    request.target.level,
    defenseReduction,
    0,
  ).multiplier;
  const motionValueMultiplier = motionValueBasisPoints / 10000;
  const statusMultiplier = 1 + multiplierIncreasePercent / 100;
  const damageAmplificationMultiplier = 1 + damageAmplificationPercent / 100;
  const totalDamageBonusMultiplier = 1 + totalDamageBonusPercent / 100;
  const nonCrit =
    levelConstant *
    motionValueMultiplier *
    statusMultiplier *
    defenseMultiplier *
    resistanceMultiplier *
    damageAmplificationMultiplier *
    totalDamageBonusMultiplier;

  const crit = request.critOverride;
  if (crit) {
    nonNegative(crit.critRatePercent, "Negative Status Crit Rate");
    nonNegative(crit.critDamagePercent, "Negative Status Crit DMG");
  }
  const effectiveCritRate = crit ? Math.min(1, crit.critRatePercent / 100) : 0;
  const critDamageMultiplier = crit ? crit.critDamagePercent / 100 : 1;
  const expectedCritMultiplier =
    1 + effectiveCritRate * (critDamageMultiplier - 1);

  return {
    status: "supported",
    formula: "negative-status-v0.2",
    kind: request.kind,
    element,
    attackerLevel: request.attackerLevel,
    enemyLevel: request.target.level,
    stacks: request.stacks,
    levelConstant,
    motionValueBasisPoints,
    motionValueMultiplier,
    multiplierIncreasePercent,
    defenseReduction,
    defenseMultiplier,
    baseResistance,
    resistanceReduction,
    effectiveResistance,
    resistanceMultiplier,
    damageAmplificationPercent,
    damageAmplificationMultiplier,
    totalDamageBonusPercent,
    totalDamageBonusMultiplier,
    effectiveCritRate,
    critDamageMultiplier,
    expectedCritMultiplier,
    total: {
      nonCrit,
      crit: nonCrit * critDamageMultiplier,
      expected: nonCrit * expectedCritMultiplier,
    },
  };
}
