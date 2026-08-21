import { describe, expect, it } from "vitest";

import type { CombatAction } from "./models";
import {
  countActionHits,
  resolveActionHitSchedule,
  sliceActionToHit,
} from "./team-hit-timeline";

const source = { kind: "technical-fixture" as const, source: "team hit test" };

function action(
  timings: readonly number[] | null,
  multipliers: CombatAction["multipliers"] = [
    { percent: 20, hits: 1 },
    { percent: 40, hits: 2 },
  ],
): CombatAction {
  return {
    id: "multi-hit",
    name: "Multi Hit",
    talent: "basicAttack",
    damageType: "basicAttack",
    level: 1,
    multipliers,
    castDurationSeconds: { value: 1, confidence: "technical-fixture" },
    recoverySeconds: { value: 0, confidence: "technical-fixture" },
    hitTimingsSeconds: {
      value: timings,
      confidence: timings === null ? "unknown" : "technical-fixture",
    },
    source,
  };
}

describe("Team per-hit timeline primitives", () => {
  it("preserves exact authored hit order and offsets", () => {
    const definition = action([0.1, 0.4, 0.9]);
    expect(countActionHits(definition)).toBe(3);
    expect(resolveActionHitSchedule(definition)).toEqual({
      status: "supported",
      hits: [
        { hitIndex: 0, offsetSeconds: 0.1 },
        { hitIndex: 1, offsetSeconds: 0.4 },
        { hitIndex: 2, offsetSeconds: 0.9 },
      ],
    });
  });

  it("fails closed on missing, mismatched, or decreasing timings", () => {
    expect(resolveActionHitSchedule(action(null))).toMatchObject({
      status: "missing",
      code: "missing-hit-timings",
    });
    expect(resolveActionHitSchedule(action([0.1, 0.2]))).toMatchObject({
      status: "unsupported",
      code: "hit-count-mismatch",
    });
    expect(resolveActionHitSchedule(action([0.2, 0.1, 0.3]))).toMatchObject({
      status: "unsupported",
      code: "invalid-hit-timing",
    });
  });

  it("splits the already-modified grouped Motion Values by flattened hit index", () => {
    const modified = action([0.1, 0.4, 0.9], [
      { percent: 30, hits: 1 },
      { percent: 70, hits: 2 },
    ]);
    expect(sliceActionToHit(modified, 0)).toMatchObject({
      status: "supported",
      action: { multipliers: [{ percent: 30, hits: 1 }] },
    });
    expect(sliceActionToHit(modified, 1)).toMatchObject({
      status: "supported",
      action: { multipliers: [{ percent: 70, hits: 1 }] },
    });
    expect(sliceActionToHit(modified, 2)).toMatchObject({
      status: "supported",
      action: { multipliers: [{ percent: 70, hits: 1 }] },
    });
    expect(sliceActionToHit(modified, 3)).toMatchObject({
      status: "unsupported",
      code: "hit-count-mismatch",
    });
  });
});
