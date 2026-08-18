import {
  calculateActionDamage,
  type DamageAmounts,
  type DamageModifiers,
  type DamageTarget,
  type DamageType,
  type ScalingAttribute,
  type StandardDamageResult,
  type UnsupportedDamageResult,
} from "./damage-engine";
import {
  skillTypes,
  type CombatAction,
  type Element,
  type FinalStats,
  type SkillType,
  type TalentLevel,
} from "./models";

export interface PersonalDpsRotationStepV1 {
  actionId: string;
  count?: number;
  talentLevel?: TalentLevel;
  scalingAttribute?: ScalingAttribute;
  effectiveDamageType?: DamageType;
  modifiers?: DamageModifiers;
}

export interface PersonalDpsRotationV1 {
  id: string;
  name: string;
  steps: readonly PersonalDpsRotationStepV1[];
  /** Exact/verified duration only. Omit rather than guess. */
  durationSeconds?: number;
  sourceNote?: string;
}

export interface PersonalDpsProfileV1 {
  resonatorId: string;
  element: Element;
  actions: readonly CombatAction[];
  rotations: readonly PersonalDpsRotationV1[];
  defaultScalingAttribute: ScalingAttribute;
}

export interface PersonalDpsRequestV1 {
  profile: PersonalDpsProfileV1;
  rotationId: string;
  finalStats: FinalStats;
  attackerLevel: number;
  target: DamageTarget;
  skillLevels?: Readonly<Partial<Record<SkillType, TalentLevel>>>;
  globalModifiers?: DamageModifiers;
}

export interface PersonalDpsResolvedStepV1 {
  index: number;
  actionId: string;
  actionName: string;
  count: number;
  talentLevel: TalentLevel;
  result: StandardDamageResult;
  subtotal: DamageAmounts;
}

export interface PersonalDpsUnsupportedStepV1 {
  index: number;
  actionId: string;
  actionName: string;
  count: number;
  talentLevel: TalentLevel;
  result: UnsupportedDamageResult;
}

export interface PersonalDpsBreakdownV1 {
  byAction: Readonly<Record<string, DamageAmounts>>;
  byDamageType: Readonly<Partial<Record<DamageType, DamageAmounts>>>;
}

export interface PersonalDpsResultV1 {
  status: "supported" | "partial";
  resonatorId: string;
  rotationId: string;
  durationSeconds: number | null;
  totals: DamageAmounts;
  dps: DamageAmounts | null;
  resolvedSteps: readonly PersonalDpsResolvedStepV1[];
  unsupportedSteps: readonly PersonalDpsUnsupportedStepV1[];
  breakdown: PersonalDpsBreakdownV1;
}

export class PersonalDpsCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonalDpsCalculationError";
  }
}

const ZERO: DamageAmounts = { nonCrit: 0, crit: 0, expected: 0 };

function add(left: DamageAmounts, right: DamageAmounts): DamageAmounts {
  return {
    nonCrit: left.nonCrit + right.nonCrit,
    crit: left.crit + right.crit,
    expected: left.expected + right.expected,
  };
}

function multiply(amounts: DamageAmounts, multiplier: number): DamageAmounts {
  return {
    nonCrit: amounts.nonCrit * multiplier,
    crit: amounts.crit * multiplier,
    expected: amounts.expected * multiplier,
  };
}

function mergeModifiers(
  globalModifiers?: DamageModifiers,
  stepModifiers?: DamageModifiers,
): DamageModifiers | undefined {
  if (!globalModifiers && !stepModifiers) return undefined;
  const keys: readonly (keyof DamageModifiers)[] = [
    "allDamageBonusPercent",
    "additionalElementalDamageBonusPercent",
    "additionalDamageTypeBonusPercent",
    "damageAmplificationPercent",
    "defenseReduction",
    "defenseIgnore",
    "resistanceReduction",
    "resistanceIgnore",
    "critRateBonusPercent",
    "critDamageBonusPercent",
  ];
  const merged: DamageModifiers = {};
  for (const key of keys) {
    const value = (globalModifiers?.[key] ?? 0) + (stepModifiers?.[key] ?? 0);
    if (value !== 0) merged[key] = value;
  }
  return merged;
}

function isSkillType(value: CombatAction["talent"]): value is SkillType {
  return skillTypes.includes(value as SkillType);
}

function resolvedTalentLevel(
  action: CombatAction,
  step: PersonalDpsRotationStepV1,
  skillLevels?: Readonly<Partial<Record<SkillType, TalentLevel>>>,
): TalentLevel {
  if (step.talentLevel !== undefined) return step.talentLevel;
  if (isSkillType(action.talent)) {
    return skillLevels?.[action.talent] ?? action.level;
  }
  return action.level;
}

function actionAtTalentLevel(
  action: CombatAction,
  level: TalentLevel,
): CombatAction | UnsupportedDamageResult {
  if (level === action.level) return action;
  const multipliers = action.multipliersByTalentLevel?.[level];
  if (!multipliers) {
    return {
      status: "unsupported",
      actionId: action.id,
      actionName: action.name,
      reason: "missing-exact-talent-data",
      message: `No exact Motion Values are available for talent level ${level}.`,
    };
  }
  return { ...action, level, multipliers };
}

function isUnsupportedProjection(
  value: CombatAction | UnsupportedDamageResult,
): value is UnsupportedDamageResult {
  return "status" in value && value.status === "unsupported";
}

function validateProfile(profile: PersonalDpsProfileV1): void {
  if (!profile.resonatorId) {
    throw new PersonalDpsCalculationError("resonatorId must be non-empty.");
  }
  const actionIds = new Set<string>();
  for (const action of profile.actions) {
    if (!action.id || actionIds.has(action.id)) {
      throw new PersonalDpsCalculationError(
        `Action id ${JSON.stringify(action.id)} must be non-empty and unique.`,
      );
    }
    actionIds.add(action.id);
  }
  const rotationIds = new Set<string>();
  for (const rotation of profile.rotations) {
    if (!rotation.id || rotationIds.has(rotation.id)) {
      throw new PersonalDpsCalculationError(
        `Rotation id ${JSON.stringify(rotation.id)} must be non-empty and unique.`,
      );
    }
    rotationIds.add(rotation.id);
    if (
      rotation.durationSeconds !== undefined &&
      (!Number.isFinite(rotation.durationSeconds) || rotation.durationSeconds <= 0)
    ) {
      throw new PersonalDpsCalculationError(
        `Rotation ${rotation.id} duration must be finite and positive.`,
      );
    }
    for (const [index, step] of rotation.steps.entries()) {
      if (!actionIds.has(step.actionId)) {
        throw new PersonalDpsCalculationError(
          `Rotation ${rotation.id} step ${index} references unknown action ${step.actionId}.`,
        );
      }
      const count = step.count ?? 1;
      if (!Number.isInteger(count) || count <= 0) {
        throw new PersonalDpsCalculationError(
          `Rotation ${rotation.id} step ${index} count must be a positive integer.`,
        );
      }
    }
  }
}

export function calculatePersonalDpsV1(
  request: PersonalDpsRequestV1,
): PersonalDpsResultV1 {
  validateProfile(request.profile);
  const rotation = request.profile.rotations.find(
    (candidate) => candidate.id === request.rotationId,
  );
  if (!rotation) {
    throw new PersonalDpsCalculationError(
      `Unknown rotation ${request.rotationId} for ${request.profile.resonatorId}.`,
    );
  }

  const actions = new Map(
    request.profile.actions.map((action) => [action.id, action] as const),
  );
  const resolvedSteps: PersonalDpsResolvedStepV1[] = [];
  const unsupportedSteps: PersonalDpsUnsupportedStepV1[] = [];
  const byAction: Record<string, DamageAmounts> = {};
  const byDamageType: Partial<Record<DamageType, DamageAmounts>> = {};
  let totals = { ...ZERO };

  for (const [index, step] of rotation.steps.entries()) {
    const action = actions.get(step.actionId)!;
    const count = step.count ?? 1;
    const talentLevel = resolvedTalentLevel(action, step, request.skillLevels);
    const projected = actionAtTalentLevel(action, talentLevel);

    if (isUnsupportedProjection(projected)) {
      unsupportedSteps.push({
        index,
        actionId: action.id,
        actionName: action.name,
        count,
        talentLevel,
        result: projected,
      });
      continue;
    }

    const modifiers = mergeModifiers(request.globalModifiers, step.modifiers);
    const result = calculateActionDamage({
      action: projected,
      finalStats: request.finalStats,
      attackerLevel: request.attackerLevel,
      scalingAttribute:
        step.scalingAttribute ?? request.profile.defaultScalingAttribute,
      element: request.profile.element,
      target: request.target,
      ...(step.effectiveDamageType !== undefined
        ? { effectiveDamageType: step.effectiveDamageType }
        : {}),
      ...(modifiers !== undefined ? { modifiers } : {}),
    });

    if (result.status === "unsupported") {
      unsupportedSteps.push({
        index,
        actionId: action.id,
        actionName: action.name,
        count,
        talentLevel,
        result,
      });
      continue;
    }

    const subtotal = multiply(result.total, count);
    totals = add(totals, subtotal);
    byAction[action.id] = add(byAction[action.id] ?? ZERO, subtotal);
    byDamageType[result.effectiveDamageType] = add(
      byDamageType[result.effectiveDamageType] ?? ZERO,
      subtotal,
    );
    resolvedSteps.push({
      index,
      actionId: action.id,
      actionName: action.name,
      count,
      talentLevel,
      result,
      subtotal,
    });
  }

  const durationSeconds = rotation.durationSeconds ?? null;
  const exact = unsupportedSteps.length === 0;
  const dps =
    exact && durationSeconds !== null
      ? multiply(totals, 1 / durationSeconds)
      : null;

  return {
    status: exact ? "supported" : "partial",
    resonatorId: request.profile.resonatorId,
    rotationId: rotation.id,
    durationSeconds,
    totals,
    dps,
    resolvedSteps,
    unsupportedSteps,
    breakdown: { byAction, byDamageType },
  };
}
