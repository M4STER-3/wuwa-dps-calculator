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
  /** Physical RES is independent from every elemental resistance. */
  physicalResistance: number;
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
  | "unsupported-tune-break-level"
  | "invalid-resonance-mode"
  | "missing-standard-damage-type"
  | "missing-motion-values"
  | "missing-exact-talent-data";

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

export type TuneEnemyClass = "1C" | "3C" | "4C";
export type ResonanceMode = string;

export const TUNE_ENEMY_BASE: Readonly<Record<TuneEnemyClass, number>> = {
  "1C": 716,
  "3C": 2149,
  "4C": 10027,
};

export interface TuneDamageModifiers {
  defenseReduction?: number;
  defenseIgnore?: number;
  resistanceReduction?: number;
  resistanceIgnore?: number;
  temporaryTuneBreakBoostPercent?: number;
}

export interface TuneBreakRequest {
  finalStats: FinalStats;
  attackerLevel: number;
  enemyClass: TuneEnemyClass;
  target: DamageTarget;
  modifiers?: TuneDamageModifiers;
  /** Required outside level 90, where the verified multiplier is 16. */
  verifiedLevelMultiplier?: number;
}

export interface TuneCritOverride {
  critRatePercent: number;
  critDamagePercent: number;
}

export interface TuneRuptureRequest {
  action: CombatAction;
  finalStats: FinalStats;
  attackerLevel: number;
  enemyClass: TuneEnemyClass;
  element: Element;
  target: DamageTarget;
  modifiers?: TuneDamageModifiers;
  additionalTuneAmpPercent?: number;
  critOverride?: TuneCritOverride;
  /** Optional data-owned mode gate. The generic formula knows no Resonator ids. */
  context?: { resonanceMode: ResonanceMode; requiredResonanceMode?: ResonanceMode };
}

export interface TuneDamageResult {
  status: "supported";
  formula: "tune-break-v0.2" | "tune-rupture-v0.2";
  tuneEnemyBase: number;
  defenseReduction: number;
  defenseIgnore: number;
  defenseMultiplier: number;
  baseResistance: number;
  resistanceReduction: number;
  resistanceIgnore: number;
  effectiveResistance: number;
  resistanceMultiplier: number;
  permanentTuneBreakBoostPercent: number;
  temporaryTuneBreakBoostPercent: number;
  effectiveTuneBreakBoostPercent: number;
  tuneBreakBoostMultiplier: number;
  tuneAmpPercent?: number;
  levelMultiplier?: number;
  expectedCritMultiplier: number;
  total: DamageAmounts;
}

export type TuneBreakResult = TuneDamageResult & { formula: "tune-break-v0.2" };
export type TuneRuptureResult = TuneDamageResult & { formula: "tune-rupture-v0.2" };
export type PersonalDamageResult =
  | StandardDamageResult
  | TuneDamageResult
  | UnsupportedDamageResult;

export function rupturousTrailTuneAmp(stacks: number): number {
  if (!Number.isInteger(stacks) || stacks < 0) {
    throw new DamageCalculationError("Les stacks Rupturous Trail doivent être un entier positif.");
  }
  return 4 * stacks;
}

function tuneCommon(
  request: Pick<TuneBreakRequest, "finalStats" | "attackerLevel" | "target" | "modifiers">,
  baseResistance: number,
) {
  validateFinalStats(request.finalStats);
  assertLevel(request.attackerLevel, "Le niveau de l'attaquant");
  assertLevel(request.target.level, "Le niveau de l'ennemi");
  assertFinite(baseResistance, "La résistance Tune brute");
  const modifiers = request.modifiers ?? {};
  const defenseReduction = ratioModifier(modifiers, "defenseReduction", 1);
  const defenseIgnore = ratioModifier(modifiers, "defenseIgnore", 1);
  const resistanceReduction = ratioModifier(modifiers, "resistanceReduction");
  const resistanceIgnore = ratioModifier(modifiers, "resistanceIgnore");
  const temporaryTuneBreakBoostPercent =
    modifiers.temporaryTuneBreakBoostPercent ?? 0;
  assertFinite(
    temporaryTuneBreakBoostPercent,
    "Le Tune Break Boost temporaire",
  );
  const defenseMultiplier = calculateDefenseMultiplier(
    request.attackerLevel,
    request.target.level,
    defenseReduction,
    defenseIgnore,
  ).multiplier;
  const effectiveResistance =
    baseResistance - resistanceReduction - resistanceIgnore;
  const resistanceMultiplier =
    calculateResistanceMultiplier(effectiveResistance);
  const permanentTuneBreakBoostPercent = request.finalStats.tuneBreakBoost;
  const effectiveTuneBreakBoostPercent =
    permanentTuneBreakBoostPercent + temporaryTuneBreakBoostPercent;
  const tuneBreakBoostMultiplier =
    1 + percentToRatio(effectiveTuneBreakBoostPercent);
  if (tuneBreakBoostMultiplier < 0) {
    throw new DamageCalculationError(
      "Le Tune Break Boost effectif ne peut pas produire un multiplicateur négatif.",
    );
  }
  return {
    defenseReduction,
    defenseIgnore,
    defenseMultiplier,
    baseResistance,
    resistanceReduction,
    resistanceIgnore,
    effectiveResistance,
    resistanceMultiplier,
    permanentTuneBreakBoostPercent,
    temporaryTuneBreakBoostPercent,
    effectiveTuneBreakBoostPercent,
    tuneBreakBoostMultiplier,
  };
}

export function calculateTuneBreakDamage(
  request: TuneBreakRequest,
): TuneDamageResult | UnsupportedDamageResult {
  const placeholder = { id: "tune-break", name: "Tune Break" } as CombatAction;
  const levelMultiplier =
    request.attackerLevel === 90 ? 16 : request.verifiedLevelMultiplier;
  if (levelMultiplier === undefined) {
    return unsupported(placeholder, "unsupported-tune-break-level", "Le multiplicateur Tune Break n'est vérifié qu'au niveau 90; fournissez un multiplicateur vérifié explicite.");
  }
  assertNonNegativeFinite(levelMultiplier, "Le multiplicateur de niveau Tune Break");
  const common = tuneCommon(request, request.target.physicalResistance);
  const nonCrit =
    TUNE_ENEMY_BASE[request.enemyClass] * levelMultiplier *
    common.defenseMultiplier * common.resistanceMultiplier *
    common.tuneBreakBoostMultiplier;
  return {
    status: "supported", formula: "tune-break-v0.2",
    tuneEnemyBase: TUNE_ENEMY_BASE[request.enemyClass], levelMultiplier,
    ...common, expectedCritMultiplier: 1,
    total: { nonCrit, crit: nonCrit, expected: nonCrit },
  };
}

export function calculateTuneRuptureDamage(
  request: TuneRuptureRequest,
): TuneDamageResult | UnsupportedDamageResult {
  if (request.context?.requiredResonanceMode !== undefined && request.context.resonanceMode !== request.context.requiredResonanceMode) {
    return unsupported(request.action, "invalid-resonance-mode", "The declared resonance mode does not permit this formula instance.");
  }
  if (request.action.scaling !== "tuneAmp" || request.action.multipliers.length === 0) {
    return unsupported(request.action, "missing-motion-values", "L'action ne possède aucun Tune AMP calculable.");
  }
  const additionalTuneAmpPercent = request.additionalTuneAmpPercent ?? 0;
  assertNonNegativeFinite(additionalTuneAmpPercent, "Le Tune AMP additionnel");
  const tuneAmpPercent = request.action.multipliers.reduce((sum, group, index) => {
    assertNonNegativeFinite(group.percent, `Le Tune AMP du groupe ${index}`);
    if (!Number.isInteger(group.hits) || group.hits <= 0) throw new DamageCalculationError(`Le nombre de hits du groupe ${index} est invalide.`);
    return sum + group.percent * group.hits;
  }, 0) + additionalTuneAmpPercent;
  const resistance = request.target.elementalResistance[request.element] ?? 0;
  const common = tuneCommon(request, resistance);
  const base = TUNE_ENEMY_BASE[request.enemyClass] * percentToRatio(tuneAmpPercent) *
    common.defenseMultiplier * common.resistanceMultiplier * common.tuneBreakBoostMultiplier;
  const override = request.critOverride;
  if (override) {
    assertNonNegativeFinite(override.critRatePercent, "Tune Rupture Crit Rate");
    assertNonNegativeFinite(override.critDamagePercent, "Tune Rupture Crit DMG");
  }
  const critRate = override ? Math.min(1, percentToRatio(override.critRatePercent)) : 0;
  const critDamageMultiplier = override ? percentToRatio(override.critDamagePercent) : 1;
  const expectedCritMultiplier = 1 + critRate * (critDamageMultiplier - 1);
  return {
    status: "supported", formula: "tune-rupture-v0.2",
    tuneEnemyBase: TUNE_ENEMY_BASE[request.enemyClass], tuneAmpPercent,
    ...common, expectedCritMultiplier,
    total: { nonCrit: base, crit: base * critDamageMultiplier, expected: base * expectedCritMultiplier },
  };
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
    ["Tune Break Boost", finalStats.tuneBreakBoost],
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
