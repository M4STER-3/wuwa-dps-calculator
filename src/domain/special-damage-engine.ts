import {
  calculateTuneBreakDamage,
  calculateTuneRuptureDamage,
  type DamageModifiers,
  type DamageTarget,
  type TuneCritOverride,
  type TuneDamageModifiers,
  type TuneDamageResult,
  type TuneEnemyClass,
  type UnsupportedDamageResult,
} from "./damage-engine";
import {
  calculateNegativeStatusDamage,
  type NegativeStatusDamageKind,
  type NegativeStatusDamageResult,
} from "./negative-status-damage";
import type { CombatAction, Element } from "./models";
import type { CombatEvent } from "./state-engine";

export interface SpecialDamageTarget extends DamageTarget {
  /** Explicit because Tune formulas are enemy-class based. The engine never guesses it. */
  tuneEnemyClass?: TuneEnemyClass;
}

export type SpecialComputedDamage =
  | TuneDamageResult
  | NegativeStatusDamageResult;

export interface FixedScenarioDamageResult {
  status: "supported";
  formula: "fixed-scenario-damage";
  actionId: string;
  actionName: string;
  damageType?: string;
  total: {
    nonCrit: number;
    crit: number;
    expected: number;
  };
}

export type SpecialDamageResolution =
  | { status: "not-special" }
  | { status: "suppressed" }
  | {
      status: "unsupported";
      code: string;
      message: string;
      damage?: UnsupportedDamageResult;
    }
  | {
      status: "supported";
      attribution: "tune" | "status";
      damage: SpecialComputedDamage;
    };

export interface SpecialDamageRequest {
  event: CombatEvent;
  action: CombatAction;
  finalStats: Parameters<typeof calculateTuneRuptureDamage>[0]["finalStats"];
  attackerLevel: number;
  element: Element;
  target: SpecialDamageTarget;
  tuneModifiers?: TuneDamageModifiers;
  damageModifiers?: DamageModifiers;
  critOverride?: TuneCritOverride;
  /** Resolved by the runtime from a status id when the event asks for it. */
  statusStacks?: number;
}

function negativeStatusKind(event: CombatEvent): NegativeStatusDamageKind | undefined {
  if (event.kind === "fusion-burst") return "fusionBurst";
  if (event.kind !== "custom") return undefined;
  const kind = event.payload?.negativeStatusKind;
  return kind === "fusionBurst" || kind === "glacioChafe" ? kind : undefined;
}

export function isSpecialDamageEvent(
  event: CombatEvent,
  action?: CombatAction,
): boolean {
  return (
    event.kind === "tune-break" ||
    event.kind === "tune-rupture" ||
    event.kind === "fusion-burst" ||
    negativeStatusKind(event) !== undefined ||
    action?.damageType === "tuneRupture"
  );
}

/**
 * Formula router shared by any runtime that already resolved stats/effects.
 * It deliberately knows only combat event kinds and formula inputs, never
 * Resonator ids, scenarios, slots or build presets.
 */
export function resolveSpecialDamage(
  request: SpecialDamageRequest,
): SpecialDamageResolution {
  const { event, action } = request;
  if (!isSpecialDamageEvent(event, action)) return { status: "not-special" };
  if (event.payload?.noDamage === true || event.payload?.applicationOnly === true) {
    return { status: "suppressed" };
  }

  try {
    if (event.kind === "tune-break") {
      if (!request.target.tuneEnemyClass) {
        return {
          status: "unsupported",
          code: "tune-enemy-class-required",
          message: "Tune Break requires an explicit enemy class (1C, 3C or 4C).",
        };
      }
      const damage = calculateTuneBreakDamage({
        finalStats: request.finalStats,
        attackerLevel: request.attackerLevel,
        enemyClass: request.target.tuneEnemyClass,
        target: request.target,
        modifiers: request.tuneModifiers,
      });
      if (damage.status === "unsupported") {
        return {
          status: "unsupported",
          code: damage.reason,
          message: damage.message,
          damage,
        };
      }
      return { status: "supported", attribution: "tune", damage };
    }

    if (event.kind === "tune-rupture" || action.damageType === "tuneRupture") {
      if (!request.target.tuneEnemyClass) {
        return {
          status: "unsupported",
          code: "tune-enemy-class-required",
          message: "Tune Rupture requires an explicit enemy class (1C, 3C or 4C).",
        };
      }
      const damage = calculateTuneRuptureDamage({
        action,
        finalStats: request.finalStats,
        attackerLevel: request.attackerLevel,
        enemyClass: request.target.tuneEnemyClass,
        element: request.element,
        target: request.target,
        modifiers: request.tuneModifiers,
        critOverride: request.critOverride,
      });
      if (damage.status === "unsupported") {
        return {
          status: "unsupported",
          code: damage.reason,
          message: damage.message,
          damage,
        };
      }
      return { status: "supported", attribution: "tune", damage };
    }

    const statusKind = negativeStatusKind(event);
    if (!statusKind) return { status: "not-special" };
    const modifiers = request.damageModifiers ?? {};
    const damage = calculateNegativeStatusDamage({
      kind: statusKind,
      attackerLevel: request.attackerLevel,
      target: request.target,
      stacks: Number(request.statusStacks ?? event.payload?.stacks ?? 10),
      ...(event.payload?.motionValueBasisPointsOverride === undefined
        ? {}
        : {
            motionValueBasisPointsOverride: Number(
              event.payload.motionValueBasisPointsOverride,
            ),
          }),
      multiplierIncreasePercent: Number(
        event.payload?.multiplierIncreasePercent ?? 0,
      ),
      damageAmplificationPercent:
        (modifiers.damageAmplificationPercent ?? 0) +
        Number(event.payload?.damageAmplificationPercent ?? 0),
      totalDamageBonusPercent:
        (modifiers.allDamageBonusPercent ?? 0) +
        Number(event.payload?.totalDamageBonusPercent ?? 0),
      defenseReduction: modifiers.defenseReduction ?? 0,
      resistanceReduction: modifiers.resistanceReduction ?? 0,
      critOverride: request.critOverride,
    });
    return { status: "supported", attribution: "status", damage };
  } catch (error) {
    return {
      status: "unsupported",
      code: "special-damage-invalid",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Personal scenarios may declare truly fixed damage that bypasses formulas. */
export function resolveFixedScenarioDamage(
  event: CombatEvent,
): FixedScenarioDamageResult | undefined {
  const amount = Number(event.payload?.fixedDamageAmount);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  const actionId = event.actionId ?? "scenario-fixed-damage";
  return {
    status: "supported",
    formula: "fixed-scenario-damage",
    actionId,
    actionName: actionId,
    damageType:
      typeof event.payload?.fixedDamageType === "string"
        ? event.payload.fixedDamageType
        : undefined,
    total: { nonCrit: amount, crit: amount, expected: amount },
  };
}
