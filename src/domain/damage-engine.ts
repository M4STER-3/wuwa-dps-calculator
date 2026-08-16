import type {
  CombatAction,
  Element,
  FinalStats,
} from "./models";
import { damageTypes, elements } from "./models";

export type DamageType = (typeof damageTypes)[number];
export type ScalingAttribute = "attack" | "hp" | "defense";

export interface DamageTarget {
  level: number;
  elementalResistance: Readonly<Partial<Record<Element, number>>>;
}

export interface DamageModifiers {
  allDamageBonusPercent?: number;
  additionalElementalDamageBonusPercent?: number;
  additionalDamageTypeBonusPercent?: number;
  damageAmplificationPercent?: number;
  defenseReduction?: number;
  defenseIgnore?: number;
  resistanceReduction?: number;
  resistanceIgnore?: number;
  critRateBonusPercent?: number;
  critDamageBonusPercent?: number;
}

export interface StandardDamageRequest {
  action: CombatAction;
  finalStats: FinalStats;
  attackerLevel: number;
  scalingAttribute: ScalingAttribute;
  element: Element;
  target: DamageTarget;
  effectiveDamageType?: DamageType;
  modifiers?: DamageModifiers;
}

export type UnsupportedDamageReason =
  | "tune-amp-not-implemented"
  | "missing-standard-damage-type"
  | "missing-motion-values";

export interface UnsupportedDamageResult {
  status: "unsupported";
  actionId: string;
  actionName: string;
  reason: UnsupportedDamageReason;
  message: string;
}

export interface DamageAmounts {
  nonCrit: number;
  crit: number;
  expected: number;
}

export interface HitGroupDamage {
  groupIndex: number;
  motionValuePercentPerHit: number;
  motionValuePerHit: number;
  hits: number;
  totalMotionValue: number;
  baseAbilityDamagePerHit: number;
  damagePerHit: DamageAmounts;
  subtotal: DamageAmounts;
}

export interface StandardDamageResult {
  status: "supported";
  formula: "standard-damage-v0.1";
  actionId: string;
  actionName: string;
  element: Element;
  baseDamageType: CombatAction["damageType"];
  effectiveDamageType: DamageType;
  scalingAttribute: ScalingAttribute;
  scalingAttributeValue: number;
  attackerLevel: number;
  enemyLevel: number;
  enemyBaseDefense: number;
  attackerLevelTerm: number;
  defenseReduction: number;
  defenseIgnore: number;
  defenseMultiplier: number;
  baseElementalResistance: number;
  resistanceReduction: number;
  resistanceIgnore: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  elementalDamageBonusPercent: number;
  damageTypeBonusPercent: number;
  allDamageBonusPercent: number;
  additionalElementalDamageBonusPercent: number;
  additionalDamageTypeBonusPercent: number;
  totalDamageBonusPercent: number;
  damageBonusMultiplier: number;
  damageAmplificationPercent: number;
  damageAmplificationMultiplier: number;
  rawCritRatePercent: number;
  effectiveCritRate: number;
  critDamagePercent: number;
  critDamageMultiplier: number;
  expectedCritMultiplier: number;
  totalMotionValue: number;
  baseAbilityDamage: number;
  hitCount: number;
  hitGroups: readonly HitGroupDamage[];
  total: DamageAmounts;
}

export type DamageResult = StandardDamageResult | UnsupportedDamageResult;

export class DamageCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DamageCalculationError";
  }
}

export const percentToRatio = (percent: number): number => percent / 100;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new DamageCalculationError(`${label} doit être un nombre fini.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new DamageCalculationError(`${label} ne peut pas être négatif.`);
  }
}

function assertLevel(level: number, label: string): void {
  if (!Number.isInteger(level) || level <= 0) {
    throw new DamageCalculationError(
      `${label} doit être un entier strictement positif.`,
    );
  }
}

function modifier(
  modifiers: DamageModifiers,
  key: keyof DamageModifiers,
): number {
  const value = modifiers[key] ?? 0;
  assertFinite(value, key);
  return value;
}

function ratioModifier(
  modifiers: DamageModifiers,
  key:
    | "defenseReduction"
    | "defenseIgnore"
    | "resistanceReduction"
    | "resistanceIgnore",
  maximum?: number,
): number {
  const value = modifier(modifiers, key);
  if (value < 0 || (maximum !== undefined && value > maximum)) {
    throw new DamageCalculationError(
      `${key} doit rester entre 0 et ${maximum ?? "l'infini"}.`,
    );
  }
  return value;
}

export function calculateDefenseMultiplier(
  attackerLevel: number,
  enemyLevel: number,
  defenseReduction = 0,
  defenseIgnore = 0,
): {
  attackerLevelTerm: number;
  enemyBaseDefense: number;
  multiplier: number;
} {
  assertLevel(attackerLevel, "Le niveau de l'attaquant");
  assertLevel(enemyLevel, "Le niveau de l'ennemi");
  for (const [label, value] of [
    ["DEF Reduction", defenseReduction],
    ["DEF Ignore", defenseIgnore],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new DamageCalculationError(`${label} doit rester entre 0 et 1.`);
    }
  }
  const attackerLevelTerm = 800 + 8 * attackerLevel;
  const enemyBaseDefense = 8 * enemyLevel + 792;
  const multiplier =
    attackerLevelTerm /
    (attackerLevelTerm +
      enemyBaseDefense * (1 - defenseReduction) * (1 - defenseIgnore));
  return { attackerLevelTerm, enemyBaseDefense, multiplier };
}

export function calculateResistanceMultiplier(resistance: number): number {
  assertFinite(resistance, "La résistance effective");
  if (resistance < 0) return 1 - resistance / 2;
  if (resistance < 0.8) return 1 - resistance;
  return 1 / (5 * resistance + 1);
}

function unsupported(
  action: CombatAction,
  reason: UnsupportedDamageReason,
  message: string,
): UnsupportedDamageResult {
  return {
    status: "unsupported",
    actionId: action.id,
    actionName: action.name,
    reason,
    message,
  };
}

function validateFinalStats(finalStats: FinalStats): void {
  for (const [label, value] of [
    ["HP final", finalStats.hp],
    ["ATK finale", finalStats.attack],
    ["DEF finale", finalStats.defense],
    ["Crit Rate", finalStats.critRate],
    ["Crit DMG", finalStats.critDamage],
  ] as const) {
    assertNonNegativeFinite(value, label);
  }
  for (const element of elements) {
    assertFinite(
      finalStats.elementalDamageBonus[element],
      `${element} DMG Bonus`,
    );
  }
  for (const damageType of damageTypes) {
    assertFinite(
      finalStats.damageTypeBonus[damageType],
      `${damageType} DMG Bonus`,
    );
  }
}

export function calculateActionDamage(
  request: StandardDamageRequest,
): DamageResult {
  const { action, finalStats, element, target } = request;
  if (action.scaling === "tuneAmp") {
    return unsupported(
      action,
      "tune-amp-not-implemented",
      "La formule Tune Amp/Tune Rupture n'est pas implémentée dans Damage Engine V0.1.",
    );
  }
  const effectiveDamageType = request.effectiveDamageType ?? action.damageType;
  if (
    !effectiveDamageType ||
    !damageTypes.includes(effectiveDamageType as DamageType)
  ) {
    return unsupported(
      action,
      "missing-standard-damage-type",
      "L'action ne possède pas de type de dégâts standard résolu.",
    );
  }
  if (action.multipliers.length === 0) {
    return unsupported(
      action,
      "missing-motion-values",
      "L'action ne possède aucun Motion Value calculable.",
    );
  }

  validateFinalStats(finalStats);
  assertLevel(request.attackerLevel, "Le niveau de l'attaquant");
  assertLevel(target.level, "Le niveau de l'ennemi");
  const scalingAttributeValue = finalStats[request.scalingAttribute];
  assertNonNegativeFinite(
    scalingAttributeValue,
    `La statistique de scaling ${request.scalingAttribute}`,
  );
  const modifiers = request.modifiers ?? {};
  const allDamageBonusPercent = modifier(modifiers, "allDamageBonusPercent");
  const additionalElementalDamageBonusPercent = modifier(
    modifiers,
    "additionalElementalDamageBonusPercent",
  );
  const additionalDamageTypeBonusPercent = modifier(
    modifiers,
    "additionalDamageTypeBonusPercent",
  );
  const damageAmplificationPercent = modifier(
    modifiers,
    "damageAmplificationPercent",
  );
  const critRateBonusPercent = modifier(modifiers, "critRateBonusPercent");
  const critDamageBonusPercent = modifier(modifiers, "critDamageBonusPercent");
  const defenseReduction = ratioModifier(
    modifiers,
    "defenseReduction",
    1,
  );
  const defenseIgnore = ratioModifier(modifiers, "defenseIgnore", 1);
  const resistanceReduction = ratioModifier(
    modifiers,
    "resistanceReduction",
  );
  const resistanceIgnore = ratioModifier(modifiers, "resistanceIgnore");

  const elementalDamageBonusPercent =
    finalStats.elementalDamageBonus[element];
  const damageTypeBonusPercent =
    finalStats.damageTypeBonus[effectiveDamageType as DamageType];
  const totalDamageBonusPercent =
    elementalDamageBonusPercent +
    damageTypeBonusPercent +
    allDamageBonusPercent +
    additionalElementalDamageBonusPercent +
    additionalDamageTypeBonusPercent;
  const damageBonusMultiplier = 1 + percentToRatio(totalDamageBonusPercent);
  const damageAmplificationMultiplier =
    1 + percentToRatio(damageAmplificationPercent);
  if (damageBonusMultiplier < 0 || damageAmplificationMultiplier < 0) {
    throw new DamageCalculationError(
      "Les groupes DMG Bonus et DMG Amplification ne peuvent pas produire un multiplicateur négatif.",
    );
  }

  const defense = calculateDefenseMultiplier(
    request.attackerLevel,
    target.level,
    defenseReduction,
    defenseIgnore,
  );
  const baseElementalResistance = target.elementalResistance[element] ?? 0;
  assertFinite(baseElementalResistance, `${element} RES`);
  const effectiveResistance =
    baseElementalResistance - resistanceReduction - resistanceIgnore;
  const resistanceMultiplier =
    calculateResistanceMultiplier(effectiveResistance);

  const rawCritRatePercent = finalStats.critRate + critRateBonusPercent;
  const effectiveCritRate = Math.min(
    1,
    Math.max(0, percentToRatio(rawCritRatePercent)),
  );
  const critDamagePercent = finalStats.critDamage + critDamageBonusPercent;
  if (critDamagePercent < 0) {
    throw new DamageCalculationError(
      "Le multiplicateur Crit DMG ne peut pas être négatif.",
    );
  }
  const critDamageMultiplier = percentToRatio(critDamagePercent);
  const expectedCritMultiplier =
    1 + effectiveCritRate * (critDamageMultiplier - 1);
  const commonMultiplier =
    damageBonusMultiplier *
    damageAmplificationMultiplier *
    defense.multiplier *
    resistanceMultiplier;

  const hitGroups = action.multipliers.map((motion, groupIndex) => {
    assertNonNegativeFinite(
      motion.percent,
      `Le Motion Value du groupe ${groupIndex}`,
    );
    if (!Number.isInteger(motion.hits) || motion.hits <= 0) {
      throw new DamageCalculationError(
        `Le nombre de hits du groupe ${groupIndex} doit être un entier strictement positif.`,
      );
    }
    const motionValuePerHit = percentToRatio(motion.percent);
    const totalMotionValue = motionValuePerHit * motion.hits;
    const baseAbilityDamagePerHit =
      scalingAttributeValue * motionValuePerHit;
    const nonCrit = baseAbilityDamagePerHit * commonMultiplier;
    const damagePerHit = {
      nonCrit,
      crit: nonCrit * critDamageMultiplier,
      expected: nonCrit * expectedCritMultiplier,
    };
    return {
      groupIndex,
      motionValuePercentPerHit: motion.percent,
      motionValuePerHit,
      hits: motion.hits,
      totalMotionValue,
      baseAbilityDamagePerHit,
      damagePerHit,
      subtotal: {
        nonCrit: damagePerHit.nonCrit * motion.hits,
        crit: damagePerHit.crit * motion.hits,
        expected: damagePerHit.expected * motion.hits,
      },
    };
  });
  const totalMotionValue = hitGroups.reduce(
    (total, group) => total + group.totalMotionValue,
    0,
  );
  const total = hitGroups.reduce<DamageAmounts>(
    (sum, group) => ({
      nonCrit: sum.nonCrit + group.subtotal.nonCrit,
      crit: sum.crit + group.subtotal.crit,
      expected: sum.expected + group.subtotal.expected,
    }),
    { nonCrit: 0, crit: 0, expected: 0 },
  );
  for (const [label, value] of Object.entries(total)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new DamageCalculationError(
        `Le total ${label} calculé est invalide.`,
      );
    }
  }

  return {
    status: "supported",
    formula: "standard-damage-v0.1",
    actionId: action.id,
    actionName: action.name,
    element,
    baseDamageType: action.damageType,
    effectiveDamageType: effectiveDamageType as DamageType,
    scalingAttribute: request.scalingAttribute,
    scalingAttributeValue,
    attackerLevel: request.attackerLevel,
    enemyLevel: target.level,
    enemyBaseDefense: defense.enemyBaseDefense,
    attackerLevelTerm: defense.attackerLevelTerm,
    defenseReduction,
    defenseIgnore,
    defenseMultiplier: defense.multiplier,
    baseElementalResistance,
    resistanceReduction,
    resistanceIgnore,
    effectiveResistance,
    resistanceMultiplier,
    elementalDamageBonusPercent,
    damageTypeBonusPercent,
    allDamageBonusPercent,
    additionalElementalDamageBonusPercent,
    additionalDamageTypeBonusPercent,
    totalDamageBonusPercent,
    damageBonusMultiplier,
    damageAmplificationPercent,
    damageAmplificationMultiplier,
    rawCritRatePercent,
    effectiveCritRate,
    critDamagePercent,
    critDamageMultiplier,
    expectedCritMultiplier,
    totalMotionValue,
    baseAbilityDamage: scalingAttributeValue * totalMotionValue,
    hitCount: hitGroups.reduce((totalHits, group) => totalHits + group.hits, 0),
    hitGroups,
    total,
  };
}
