import type { FinalStats, Sequence } from "./models";
import type { TuneEnemyClass } from "./damage-engine";

export type ExternalDisplayRule = "ceiling" | "nearest" | "floor";

export interface ExternalDamageBenchmark {
  id: string;
  resonator: string;
  sourceName: string;
  sourceVerificationDate: string;
  scenarioDescription: string;
  characterLevel: number;
  sequence: Sequence;
  talentLevel: number;
  finalStats: FinalStats;
  weaponEquipmentState: string;
  targetLevel: number;
  targetResistance: { elemental: number; physical: number };
  tuneEnemyClass?: TuneEnemyClass;
  enabledEffects: readonly string[];
  actionId: string;
  expectedDisplayed: { normal: number; average: number; crit: number };
  /** Displayed damage for each hit, in action order, when the source exposes it. */
  expectedDisplayedPerHit?: readonly number[];
  provenance: string;
  confidence: "high" | "qualified";
  displayRule: ExternalDisplayRule;
  displayTolerance?: number;
  notes: string;
}

export interface ExternalDisplayComparison {
  raw: number;
  displayed: number;
  expectedDisplayed: number;
  delta: number;
  tolerance: number;
  matches: boolean;
}

/** Presentation adapter only. Damage engines must never call this function. */
export function compareExternalDisplay(
  raw: number,
  expectedDisplayed: number,
  rule: ExternalDisplayRule,
  tolerance = 0,
): ExternalDisplayComparison {
  if (![raw, expectedDisplayed, tolerance].every(Number.isFinite) || tolerance < 0) {
    throw new Error("External display comparison requires finite values and a non-negative tolerance.");
  }
  const displayed = rule === "ceiling" ? Math.ceil(raw) :
    rule === "floor" ? Math.floor(raw) : Math.round(raw);
  const delta = displayed - expectedDisplayed;
  return { raw, displayed, expectedDisplayed, delta, tolerance, matches: Math.abs(delta) <= tolerance };
}
