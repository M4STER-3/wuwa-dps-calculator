import type {
  CombatAction,
  Element,
  FinalStats,
  ResonanceMode,
} from "./models";
import { damageTypes, elements } from "./models";

export type DamageType = (typeof damageTypes)[number];
export type ScalingAttribute = "attack" | "hp" | "defense";

export interface DamageTarget {
  level: number;
  elementalResistance: Readonly<Partial<Record<Element, number>>>;
  physicalResistance?: number;
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
  tuneContext?: Omit<TuneRuptureRequest, "action">;
}

export type UnsupportedDamageReason =
  | "missing-tune-context"
  | "missing-tune-enemy-base"
  | "tune-break-level-multiplier-unverified"
  | "wrong-resonance-mode"
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

export type DamageResult =
  | StandardDamageResult
  | TuneRuptureResult
  | UnsupportedDamageResult;

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
  request: StandardDamageRequest & { tuneContext?: undefined },
): StandardDamageResult | UnsupportedDamageResult;
export function calculateActionDamage(
  request: StandardDamageRequest,
): DamageResult;
export function calculateActionDamage(
  request: StandardDamageRequest,
): DamageResult {
  const { action, finalStats, element, target } = request;
  if (action.scaling === "tuneAmp") {
    if (!request.tuneContext) {
      return unsupported(
        action,
        "missing-tune-context",
        "Une action Tune AMP exige un contexte Tune Rupture explicite.",
      );
    }
    return calculateTuneRuptureDamage({
      action,
      ...request.tuneContext,
    });
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

export type TuneEnemyCost = 1 | 3 | 4;

export const tuneEnemyBaseByCost: Readonly<Record<TuneEnemyCost, number>> = {
  1: 716,
  3: 2149,
  4: 10027,
};

export const tuneFormulaSource =
  "Formules communautaires empiriques recoupées au 2026-08-16: 库街区/17173, Bilibili (叫我棉被 avec 金铃子攻略组), Bahamut, Prydwen, Wuthering Waves Wiki/Fandom, WutheringLab; WutheringTools utilisé comme cross-check indépendant.";

export interface TuneDamageOwner {
  resonatorId: string;
  level: number;
  finalStats: FinalStats;
  resonanceMode: ResonanceMode;
}

export interface TuneEnemyBaseInput {
  tuneEnemyCost?: TuneEnemyCost;
  explicitTuneBaseDamage?: number;
}

export interface TuneDefenseModifiers {
  defenseReduction?: number;
  defenseIgnore?: number;
  resistanceReduction?: number;
  resistanceIgnore?: number;
}

export interface TuneBreakRequest extends TuneEnemyBaseInput {
  owner: TuneDamageOwner;
  target: DamageTarget;
  verifiedLevelMultiplier?: number;
  temporaryTuneBreakBoostPercent?: number;
  modifiers?: Pick<
    TuneDefenseModifiers,
    "defenseReduction" | "defenseIgnore" | "resistanceReduction" | "resistanceIgnore"
  >;
}

export interface TuneBreakResult {
  status: "supported";
  formula: "tune-break-v0.2";
  source: string;
  ownerResonatorId: string;
  ownerLevel: number;
  tuneEnemyCost: TuneEnemyCost | null;
  enemyTuneBase: number;
  tuneBreakLevelMultiplier: number;
  tuneBreakLevelMultiplierSource: "verified-lv90-v0.2" | "request-verified";
  tuneBreakBase: number;
  permanentTuneBreakBoostPercent: number;
  temporaryTuneBreakBoostPercent: number;
  effectiveTuneBreakBoostPercent: number;
  tuneBreakBoostMultiplier: number;
  defenseReduction: number;
  defenseIgnore: number;
  defenseMultiplier: number;
  physicalResistance: number;
  resistanceReduction: number;
  resistanceIgnore: number;
  effectivePhysicalResistance: number;
  physicalResistanceMultiplier: number;
  canCrit: false;
  critMode: "disabled";
  damage: DamageAmounts;
}

export interface TuneCritOverride {
  critRate: number;
  critDamageMultiplier: number;
  source: string;
}

export interface TuneRuptureRequest extends TuneEnemyBaseInput {
  action: CombatAction;
  owner: TuneDamageOwner;
  element: Element;
  target: DamageTarget;
  additionalTuneAmpPercent?: number;
  instances?: number;
  temporaryTuneBreakBoostPercent?: number;
  critOverride?: TuneCritOverride;
  modifiers?: TuneDefenseModifiers;
}

export interface TuneRuptureResult {
  status: "supported";
  formula: "tune-rupture-v0.2";
  source: string;
  actionId: string;
  actionName: string;
  ownerResonatorId: string;
  ownerLevel: number;
  resonanceMode: "tune-rupture";
  tuneEnemyCost: TuneEnemyCost | null;
  enemyTuneBase: number;
  baseTuneAmpPercent: number;
  additionalTuneAmpPercent: number;
  effectiveTuneAmpPercent: number;
  effectiveTuneAmpMultiplier: number;
  instances: number;
  permanentTuneBreakBoostPercent: number;
  temporaryTuneBreakBoostPercent: number;
  effectiveTuneBreakBoostPercent: number;
  tuneBreakBoostMultiplier: number;
  element: Element;
  elementalResistance: number;
  resistanceReduction: number;
  resistanceIgnore: number;
  effectiveElementalResistance: number;
  resistanceMultiplier: number;
  defenseReduction: number;
  defenseIgnore: number;
  defenseMultiplier: number;
  canCrit: boolean;
  critMode: "disabled" | "fixed-override";
  critRate: number;
  critDamageMultiplier: number;
  expectedCritMultiplier: number;
  critOverrideSource: string | null;
  damagePerInstance: DamageAmounts;
  total: DamageAmounts;
}

export type TuneDamageResult =
  | TuneBreakResult
  | TuneRuptureResult
  | UnsupportedDamageResult;

function tuneUnsupported(
  reason: UnsupportedDamageReason,
  message: string,
  action?: CombatAction,
): UnsupportedDamageResult {
  return {
    status: "unsupported",
    actionId: action?.id ?? "tune-break",
    actionName: action?.name ?? "Tune Break",
    reason,
    message,
  };
}

function resolveTuneEnemyBase(
  input: TuneEnemyBaseInput,
): { cost: TuneEnemyCost | null; base: number } | null {
  if (input.explicitTuneBaseDamage !== undefined) {
    assertNonNegativeFinite(input.explicitTuneBaseDamage, "La base Tune explicite");
    if (input.explicitTuneBaseDamage === 0) {
      throw new DamageCalculationError(
        "La base Tune explicite doit être strictement positive.",
      );
    }
    return { cost: input.tuneEnemyCost ?? null, base: input.explicitTuneBaseDamage };
  }
  if (input.tuneEnemyCost === undefined) return null;
  return {
    cost: input.tuneEnemyCost,
    base: tuneEnemyBaseByCost[input.tuneEnemyCost],
  };
}

function resolveTuneModifiers(modifiers: TuneDefenseModifiers = {}) {
  return {
    defenseReduction: ratioModifier(modifiers, "defenseReduction", 1),
    defenseIgnore: ratioModifier(modifiers, "defenseIgnore", 1),
    resistanceReduction: ratioModifier(modifiers, "resistanceReduction"),
    resistanceIgnore: ratioModifier(modifiers, "resistanceIgnore"),
  };
}

function resolveTuneBreakBoost(
  finalStats: FinalStats,
  temporaryTuneBreakBoostPercent = 0,
) {
  assertNonNegativeFinite(finalStats.tuneBreakBoost, "Tune Break Boost permanent");
  assertFinite(temporaryTuneBreakBoostPercent, "Tune Break Boost temporaire");
  const effectivePercent =
    finalStats.tuneBreakBoost + temporaryTuneBreakBoostPercent;
  const multiplier = 1 + percentToRatio(effectivePercent);
  if (multiplier < 0) {
    throw new DamageCalculationError(
      "Tune Break Boost ne peut pas produire un multiplicateur négatif.",
    );
  }
  return { effectivePercent, multiplier };
}

export function calculateTuneAmpIncrease(
  increasePercentPerStack: number,
  stacks: number,
): number {
  assertFinite(increasePercentPerStack, "L'augmentation Tune AMP par stack");
  if (!Number.isInteger(stacks) || stacks < 0) {
    throw new DamageCalculationError(
      "Le nombre de stacks Tune AMP doit être un entier positif ou nul.",
    );
  }
  return increasePercentPerStack * stacks;
}

export function calculateEffectiveTuneAmpPercent(
  baseTuneAmpPercent: number,
  additionalTuneAmpPercent = 0,
): number {
  assertNonNegativeFinite(baseTuneAmpPercent, "Le Tune AMP de base");
  assertFinite(additionalTuneAmpPercent, "Le Tune AMP additionnel");
  const effective = baseTuneAmpPercent + additionalTuneAmpPercent;
  if (effective < 0) {
    throw new DamageCalculationError(
      "Le Tune AMP effectif ne peut pas être négatif.",
    );
  }
  return effective;
}

export function calculateTuneBreakDamage(
  request: TuneBreakRequest,
): TuneDamageResult {
  const resolvedBase = resolveTuneEnemyBase(request);
  if (!resolvedBase) {
    return tuneUnsupported(
      "missing-tune-enemy-base",
      "Tune Break exige un coût ennemi Tune ou une base Tune explicite.",
    );
  }
  assertLevel(request.owner.level, "Le niveau du propriétaire Tune Break");
  const levelMultiplier =
    request.verifiedLevelMultiplier ??
    (request.owner.level === 90 ? 16 : undefined);
  if (levelMultiplier === undefined) {
    return tuneUnsupported(
      "tune-break-level-multiplier-unverified",
      `Le multiplicateur Tune Break du niveau ${request.owner.level} n'est pas vérifié.`,
    );
  }
  assertNonNegativeFinite(levelMultiplier, "Le multiplicateur de niveau Tune Break");
  if (levelMultiplier === 0) {
    throw new DamageCalculationError(
      "Le multiplicateur de niveau Tune Break doit être strictement positif.",
    );
  }
  const physicalResistance = request.target.physicalResistance ?? 0;
  assertFinite(physicalResistance, "La résistance physique");
  const modifiers = resolveTuneModifiers(request.modifiers);
  const defense = calculateDefenseMultiplier(
    request.owner.level,
    request.target.level,
    modifiers.defenseReduction,
    modifiers.defenseIgnore,
  );
  const effectivePhysicalResistance =
    physicalResistance -
    modifiers.resistanceReduction -
    modifiers.resistanceIgnore;
  const physicalResistanceMultiplier = calculateResistanceMultiplier(
    effectivePhysicalResistance,
  );
  const boost = resolveTuneBreakBoost(
    request.owner.finalStats,
    request.temporaryTuneBreakBoostPercent,
  );
  const tuneBreakBase = resolvedBase.base * levelMultiplier;
  const damage =
    tuneBreakBase *
    defense.multiplier *
    physicalResistanceMultiplier *
    boost.multiplier;
  assertNonNegativeFinite(damage, "Les dégâts Tune Break");
  const amounts = { nonCrit: damage, crit: damage, expected: damage };
  return {
    status: "supported",
    formula: "tune-break-v0.2",
    source: tuneFormulaSource,
    ownerResonatorId: request.owner.resonatorId,
    ownerLevel: request.owner.level,
    tuneEnemyCost: resolvedBase.cost,
    enemyTuneBase: resolvedBase.base,
    tuneBreakLevelMultiplier: levelMultiplier,
    tuneBreakLevelMultiplierSource:
      request.verifiedLevelMultiplier === undefined
        ? "verified-lv90-v0.2"
        : "request-verified",
    tuneBreakBase,
    permanentTuneBreakBoostPercent: request.owner.finalStats.tuneBreakBoost,
    temporaryTuneBreakBoostPercent:
      request.temporaryTuneBreakBoostPercent ?? 0,
    effectiveTuneBreakBoostPercent: boost.effectivePercent,
    tuneBreakBoostMultiplier: boost.multiplier,
    defenseReduction: modifiers.defenseReduction,
    defenseIgnore: modifiers.defenseIgnore,
    defenseMultiplier: defense.multiplier,
    physicalResistance,
    resistanceReduction: modifiers.resistanceReduction,
    resistanceIgnore: modifiers.resistanceIgnore,
    effectivePhysicalResistance,
    physicalResistanceMultiplier,
    canCrit: false,
    critMode: "disabled",
    damage: amounts,
  };
}

export function calculateTuneRuptureDamage(
  request: TuneRuptureRequest,
): TuneRuptureResult | UnsupportedDamageResult {
  if (request.owner.resonanceMode !== "tune-rupture") {
    return tuneUnsupported(
      "wrong-resonance-mode",
      "Tune Rupture exige explicitement le Resonance Mode - Tune Rupture; Fusion Burst reste une mécanique distincte non supportée.",
      request.action,
    );
  }
  const resolvedBase = resolveTuneEnemyBase(request);
  if (!resolvedBase) {
    return tuneUnsupported(
      "missing-tune-enemy-base",
      "Tune Rupture exige un coût ennemi Tune ou une base Tune explicite.",
      request.action,
    );
  }
  if (request.action.scaling !== "tuneAmp") {
    return tuneUnsupported(
      "missing-motion-values",
      "L'action n'est pas marquée comme Tune AMP.",
      request.action,
    );
  }
  if (request.action.multipliers.length !== 1) {
    return tuneUnsupported(
      "missing-motion-values",
      "Damage Engine V0.2 attend un Tune AMP unique par instance.",
      request.action,
    );
  }
  const instances = request.instances ?? 1;
  if (!Number.isInteger(instances) || instances <= 0) {
    throw new DamageCalculationError(
      "Le nombre d'instances Tune Rupture doit être un entier strictement positif.",
    );
  }
  const baseTuneAmpPercent = request.action.multipliers[0].percent;
  const additionalTuneAmpPercent = request.additionalTuneAmpPercent ?? 0;
  const effectiveTuneAmpPercent = calculateEffectiveTuneAmpPercent(
    baseTuneAmpPercent,
    additionalTuneAmpPercent,
  );
  const effectiveTuneAmpMultiplier = percentToRatio(effectiveTuneAmpPercent);
  const modifiers = resolveTuneModifiers(request.modifiers);
  const defense = calculateDefenseMultiplier(
    request.owner.level,
    request.target.level,
    modifiers.defenseReduction,
    modifiers.defenseIgnore,
  );
  const elementalResistance =
    request.target.elementalResistance[request.element] ?? 0;
  assertFinite(elementalResistance, `${request.element} RES`);
  const effectiveElementalResistance =
    elementalResistance -
    modifiers.resistanceReduction -
    modifiers.resistanceIgnore;
  const resistanceMultiplier = calculateResistanceMultiplier(
    effectiveElementalResistance,
  );
  const boost = resolveTuneBreakBoost(
    request.owner.finalStats,
    request.temporaryTuneBreakBoostPercent,
  );
  const nonCrit =
    resolvedBase.base *
    effectiveTuneAmpMultiplier *
    defense.multiplier *
    resistanceMultiplier *
    boost.multiplier;
  assertNonNegativeFinite(nonCrit, "Les dégâts Tune Rupture");

  let critRate = 0;
  let critDamageMultiplier = 1;
  let expectedCritMultiplier = 1;
  let critMode: TuneRuptureResult["critMode"] = "disabled";
  if (request.critOverride) {
    assertFinite(request.critOverride.critRate, "Le Crit Rate Tune fixe");
    assertNonNegativeFinite(
      request.critOverride.critDamageMultiplier,
      "Le Crit DMG Tune fixe",
    );
    critRate = Math.min(1, Math.max(0, request.critOverride.critRate));
    critDamageMultiplier = request.critOverride.critDamageMultiplier;
    expectedCritMultiplier =
      1 + critRate * (critDamageMultiplier - 1);
    critMode = "fixed-override";
  }
  const damagePerInstance = {
    nonCrit,
    crit: nonCrit * critDamageMultiplier,
    expected: nonCrit * expectedCritMultiplier,
  };
  const total = {
    nonCrit: damagePerInstance.nonCrit * instances,
    crit: damagePerInstance.crit * instances,
    expected: damagePerInstance.expected * instances,
  };
  return {
    status: "supported",
    formula: "tune-rupture-v0.2",
    source: tuneFormulaSource,
    actionId: request.action.id,
    actionName: request.action.name,
    ownerResonatorId: request.owner.resonatorId,
    ownerLevel: request.owner.level,
    resonanceMode: "tune-rupture",
    tuneEnemyCost: resolvedBase.cost,
    enemyTuneBase: resolvedBase.base,
    baseTuneAmpPercent,
    additionalTuneAmpPercent,
    effectiveTuneAmpPercent,
    effectiveTuneAmpMultiplier,
    instances,
    permanentTuneBreakBoostPercent: request.owner.finalStats.tuneBreakBoost,
    temporaryTuneBreakBoostPercent:
      request.temporaryTuneBreakBoostPercent ?? 0,
    effectiveTuneBreakBoostPercent: boost.effectivePercent,
    tuneBreakBoostMultiplier: boost.multiplier,
    element: request.element,
    elementalResistance,
    resistanceReduction: modifiers.resistanceReduction,
    resistanceIgnore: modifiers.resistanceIgnore,
    effectiveElementalResistance,
    resistanceMultiplier,
    defenseReduction: modifiers.defenseReduction,
    defenseIgnore: modifiers.defenseIgnore,
    defenseMultiplier: defense.multiplier,
    canCrit: Boolean(request.critOverride),
    critMode,
    critRate,
    critDamageMultiplier,
    expectedCritMultiplier,
    critOverrideSource: request.critOverride?.source ?? null,
    damagePerInstance,
    total,
  };
}
