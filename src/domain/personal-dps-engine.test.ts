import { describe, expect, it } from "vitest";
import { calculateActionDamage } from "./damage-engine";
import {
  calculatePersonalDpsV1,
  PersonalDpsCalculationError,
  type PersonalDpsProfileV1,
} from "./personal-dps-engine";
import type { CombatAction, FinalStats } from "./models";

const unknownTiming = { value: null, confidence: "unknown" as const };
const source = { kind: "technical-fixture" as const, source: "test" };

const action: CombatAction = {
  id: "test-skill",
  name: "Test Skill",
  talent: "resonanceSkill",
  damageType: "resonanceSkill",
  level: 10,
  multipliers: [{ percent: 100, hits: 2 }],
  multipliersByTalentLevel: {
    9: [{ percent: 90, hits: 2 }],
    10: [{ percent: 100, hits: 2 }],
  },
  castDurationSeconds: unknownTiming,
  recoverySeconds: unknownTiming,
  hitTimingsSeconds: unknownTiming,
  source,
};

const finalStats: FinalStats = {
  hp: 10000,
  attack: 2000,
  defense: 1000,
  critRate: 50,
  critDamage: 200,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 20,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  damageTypeBonus: {
    basicAttack: 0,
    heavyAttack: 0,
    resonanceSkill: 30,
    resonanceLiberation: 0,
    introSkill: 0,
    echoSkill: 0,
  },
};

const target = {
  level: 90,
  elementalResistance: { electro: 0.1 },
  physicalResistance: 0.1,
};

const profile: PersonalDpsProfileV1 = {
  resonatorId: "fixture",
  element: "electro",
  actions: [action],
  defaultScalingAttribute: "attack",
  rotations: [
    {
      id: "double-cast",
      name: "Double cast",
      durationSeconds: 4,
      steps: [{ actionId: action.id, count: 2 }],
    },
    {
      id: "no-duration",
      name: "No duration",
      steps: [{ actionId: action.id }],
    },
  ],
};

describe("calculatePersonalDpsV1", () => {
  it("aggregates action damage, counts and exact rotation DPS", () => {
    const single = calculateActionDamage({
      action,
      finalStats,
      attackerLevel: 90,
      scalingAttribute: "attack",
      element: "electro",
      target,
    });
    expect(single.status).toBe("supported");
    if (single.status !== "supported") throw new Error("fixture must resolve");

    const result = calculatePersonalDpsV1({
      profile,
      rotationId: "double-cast",
      finalStats,
      attackerLevel: 90,
      target,
    });

    expect(result.status).toBe("supported");
    expect(result.unsupportedSteps).toEqual([]);
    expect(result.totals.expected).toBeCloseTo(single.total.expected * 2, 10);
    expect(result.dps?.expected).toBeCloseTo(single.total.expected / 2, 10);
    expect(result.breakdown.byAction[action.id]?.expected).toBeCloseTo(
      single.total.expected * 2,
      10,
    );
    expect(result.breakdown.byDamageType.resonanceSkill?.expected).toBeCloseTo(
      single.total.expected * 2,
      10,
    );
  });

  it("uses exact sparse talent Motion Values rather than interpolation", () => {
    const result = calculatePersonalDpsV1({
      profile,
      rotationId: "double-cast",
      finalStats,
      attackerLevel: 90,
      target,
      skillLevels: { resonanceSkill: 9 },
    });

    expect(result.status).toBe("supported");
    expect(result.resolvedSteps[0]?.talentLevel).toBe(9);
    expect(result.resolvedSteps[0]?.result.totalMotionValue).toBeCloseTo(1.8, 10);
  });

  it("fails closed when an exact requested talent level is unavailable", () => {
    const result = calculatePersonalDpsV1({
      profile,
      rotationId: "double-cast",
      finalStats,
      attackerLevel: 90,
      target,
      skillLevels: { resonanceSkill: 8 },
    });

    expect(result.status).toBe("partial");
    expect(result.dps).toBeNull();
    expect(result.resolvedSteps).toEqual([]);
    expect(result.unsupportedSteps[0]?.result.reason).toBe(
      "missing-exact-talent-data",
    );
  });

  it("does not report DPS when rotation duration is unknown", () => {
    const result = calculatePersonalDpsV1({
      profile,
      rotationId: "no-duration",
      finalStats,
      attackerLevel: 90,
      target,
    });

    expect(result.status).toBe("supported");
    expect(result.totals.expected).toBeGreaterThan(0);
    expect(result.durationSeconds).toBeNull();
    expect(result.dps).toBeNull();
  });

  it("rejects profiles whose rotations reference unknown actions", () => {
    const badProfile: PersonalDpsProfileV1 = {
      ...profile,
      rotations: [
        {
          id: "bad",
          name: "Bad",
          steps: [{ actionId: "missing" }],
        },
      ],
    };

    expect(() =>
      calculatePersonalDpsV1({
        profile: badProfile,
        rotationId: "bad",
        finalStats,
        attackerLevel: 90,
        target,
      }),
    ).toThrow(PersonalDpsCalculationError);
  });
});
