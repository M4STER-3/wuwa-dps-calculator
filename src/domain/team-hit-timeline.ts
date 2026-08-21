import type { CombatAction } from "./models";

export interface TeamActionHitPoint {
  hitIndex: number;
  offsetSeconds: number;
}

export type TeamActionHitSchedule =
  | {
      status: "supported";
      hits: readonly TeamActionHitPoint[];
    }
  | {
      status: "missing";
      code: "missing-hit-timings";
      message: string;
    }
  | {
      status: "unsupported";
      code: "hit-count-mismatch" | "invalid-hit-timing";
      message: string;
    };

export type TeamActionHitSlice =
  | { status: "supported"; action: CombatAction }
  | {
      status: "unsupported";
      code: "hit-count-mismatch";
      message: string;
    };

export function countActionHits(action: CombatAction): number {
  return action.multipliers.reduce((total, group) => total + group.hits, 0);
}

/**
 * Resolves exact data-owned hit offsets without inventing timings.
 *
 * The order is kept exactly as authored because hit index is also the index used
 * to split the grouped Motion Values after runtime modifiers have been applied.
 */
export function resolveActionHitSchedule(
  action: CombatAction,
): TeamActionHitSchedule {
  const expectedHits = countActionHits(action);
  if (expectedHits === 0) return { status: "supported", hits: [] };

  const timings = action.hitTimingsSeconds.value;
  if (timings === null) {
    return {
      status: "missing",
      code: "missing-hit-timings",
      message: `Action ${action.id} has no exact hit timings.`,
    };
  }
  if (timings.length !== expectedHits) {
    return {
      status: "unsupported",
      code: "hit-count-mismatch",
      message: `Action ${action.id} has ${expectedHits} modeled hits but ${timings.length} hit timings.`,
    };
  }

  let previous = -Infinity;
  const hits: TeamActionHitPoint[] = [];
  for (const [hitIndex, offsetSeconds] of timings.entries()) {
    if (
      !Number.isFinite(offsetSeconds) ||
      offsetSeconds < 0 ||
      offsetSeconds < previous
    ) {
      return {
        status: "unsupported",
        code: "invalid-hit-timing",
        message: `Action ${action.id} has a non-finite, negative, or decreasing hit timing at index ${hitIndex}.`,
      };
    }
    hits.push({ hitIndex, offsetSeconds });
    previous = offsetSeconds;
  }
  return { status: "supported", hits };
}

/**
 * Splits the current grouped action into one flattened hit. Call this after the
 * universal action pipeline so group-aware Motion Value modifiers are applied
 * before the hit is selected, matching Personal Combat semantics.
 */
export function sliceActionToHit(
  action: CombatAction,
  hitIndex: number,
): TeamActionHitSlice {
  const flattened = action.multipliers.flatMap((group) =>
    Array.from({ length: group.hits }, () => group.percent),
  );
  const percent = flattened[hitIndex];
  if (percent === undefined) {
    return {
      status: "unsupported",
      code: "hit-count-mismatch",
      message: `Action ${action.id} cannot resolve hit index ${hitIndex} from ${flattened.length} modeled hits.`,
    };
  }
  return {
    status: "supported",
    action: {
      ...action,
      multipliers: [{ percent, hits: 1 }],
    },
  };
}
