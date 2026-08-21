import { describe, expect, it } from "vitest";
import { calculateActionDamage } from "@/domain/damage-engine";
import type { FinalStats } from "@/domain/models";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { findPreciseDpsResonator } from "./precise-dps-loadouts";
import { SHOREKEEPER_NATIVE } from "./precise-dps-shorekeeper-core";

/**
 * Deterministic reference-parity fixtures checked 2026-08-21 against the current
 * published Shorekeeper kit and the GameDatabase projection. They exercise the
 * shared talent + standard-damage engines; they are not serialized UI snapshots.
 */
const stats: FinalStats = {
  hp: 40000,
  attack: 1000,
  defense: 1100,
  critRate: 5,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  damageTypeBonus: {
    basicAttack: 0,
    heavyAttack: 0,
    resonanceSkill: 0,
    resonanceLiberation: 0,
    introSkill: 0,
    echoSkill: 0,
  },
};

const resonator = findPreciseDpsResonator("shorekeeper")!;
const action = (id: string) =>
  resonator.combat?.actions.find((entry) => entry.id === id);

const totalMv = (groups: readonly { percent: number; hits: number }[]) =>
  groups.reduce((sum, group) => sum + group.percent * group.hits, 0);

describe("Shorekeeper current-reference formula parity", () => {
  it("locks Lv10 Discernment at 19.64% HP x3 and resolves it through the universal standard formula", () => {
    const resolved = resolveActionTalentLevel(action(SHOREKEEPER_NATIVE.discernment)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 19.64, hits: 3 }]);
    expect(totalMv(resolved.action.multipliers)).toBeCloseTo(58.92, 8);
    expect(resolved.action.scalingAttribute).toBe("hp");
    expect(resolved.action.damageType).toBe("resonanceLiberation");

    const damage = calculateActionDamage({
      action: resolved.action,
      finalStats: stats,
      attackerLevel: 90,
      scalingAttribute: "hp",
      element: "spectro",
      target: {
        level: 90,
        elementalResistance: { spectro: 0.1 },
        physicalResistance: 0.1,
      },
      modifiers: { critRateBonusPercent: 100 },
    });

    expect(damage.status).toBe("supported");
    if (damage.status !== "supported") return;
    expect(damage.totalMotionValue).toBeCloseTo(0.5892, 8);
    expect(damage.total.nonCrit).toBeCloseTo(10605.6, 8);
    expect(damage.total.expected).toBeCloseTo(damage.total.crit, 8);
  });

  it("keeps the published S6 Discernment modifiers as runtime data, not panel stats", () => {
    const definition = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-shorekeeper-discernment",
    )?.structuredEffect;
    const multiplier = definition?.rules.find(
      (rule) => rule.id === "shorekeeper-s6-discernment-multiplier",
    );
    const critDamage = definition?.rules.find(
      (rule) => rule.id === "shorekeeper-s6-discernment-crit-dmg",
    );

    expect(multiplier?.requiredSequence).toBe(6);
    expect(multiplier?.accounting).toBe("runtime");
    expect(multiplier?.modifiers).toContainEqual({
      kind: "motion-value",
      mode: "relative-additive",
      stacking: "additive",
      value: { kind: "constant", value: 42 },
    });
    expect(critDamage?.requiredSequence).toBe(6);
    expect(critDamage?.accounting).toBe("runtime");
    expect(critDamage?.modifiers).toContainEqual({
      kind: "crit-damage-bonus",
      stacking: "additive",
      value: 500,
    });
  });
});
