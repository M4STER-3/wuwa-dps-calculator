import { describe, expect, it } from "vitest";
import { calculateActionDamage } from "@/domain/damage-engine";
import type { FinalStats } from "@/domain/models";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { GALBRENA } from "./precise-dps-galbrena";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1200,
  critRate: 50,
  critDamage: 200,
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

const resonator = findPreciseDpsResonator("galbrena")!;
const weapon = findPreciseDpsWeapon("galbrena")!;
const action = (id: string) =>
  resonator.combat?.actions.find((entry) => entry.id === id);

describe("Galbrena current-reference formula parity", () => {
  it("resolves Ashen Pursuit's reviewed 795% total ATK through the universal standard formula", () => {
    const resolved = resolveActionTalentLevel(action(GALBRENA.outro)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([
      { percent: 79.5, hits: 3 },
      { percent: 556.5, hits: 1 },
    ]);
    expect(resolved.action.scalingAttribute).toBe("attack");
    expect(resolved.action.damageType).toBe("outroSkill");

    const damage = calculateActionDamage({
      action: resolved.action,
      finalStats: stats,
      attackerLevel: 90,
      scalingAttribute: "attack",
      element: "fusion",
      target: {
        level: 90,
        elementalResistance: { fusion: 0.1 },
        physicalResistance: 0.1,
      },
    });

    expect(damage.status).toBe("supported");
    if (damage.status !== "supported") return;
    expect(damage.totalMotionValue).toBeCloseTo(7.95, 8);
    expect(damage.defenseMultiplier).toBeCloseTo(1520 / 3032, 10);
    expect(damage.resistanceMultiplier).toBeCloseTo(0.9, 10);
    expect(damage.total.nonCrit).toBeCloseTo(7173.878627968337, 8);
  });

  it("keeps Hellfire, Fated End, sequences and Lux & Umbra as runtime mechanics", () => {
    const hellfire = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-galbrena-hellfire-window",
    )?.structuredEffect;
    expect(hellfire?.rules[0]?.modifiers).toContainEqual({
      kind: "motion-value",
      mode: "relative-additive",
      stacking: "additive",
      value: { kind: "constant", value: 85 },
    });

    const fated = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-galbrena-fated-end",
    )?.structuredEffect;
    expect(fated?.lifecycle).toMatchObject({
      duration: { kind: "fixed", seconds: 5.5 },
      refresh: "no-refresh",
      stacks: { kind: "independent-expirations", max: 4, initial: 0 },
    });
    expect(fated?.rules[0]?.modifiers).toContainEqual({
      kind: "damage-amplification",
      stacking: "additive",
      valuePerStack: 5,
      maxStacks: 4,
    });

    const sequences = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-galbrena-sequences",
    )?.structuredEffect;
    expect(sequences?.rules.find((rule) => rule.id === "galbrena-s3-liberation-mv")?.accounting).toBe("runtime");
    expect(sequences?.rules.find((rule) => rule.id === "galbrena-s5-skill-mv")?.accounting).toBe("runtime");
    expect(sequences?.rules.find((rule) => rule.id === "galbrena-s6-eternal-mv")?.accounting).toBe("runtime");

    const permanent = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-permanent",
    )?.structuredEffect;
    const dual = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-both-windows",
    )?.structuredEffect;
    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(dual?.rules[0]?.accounting).toBe("runtime");
    const modifier = dual?.rules[0]?.modifiers[0];
    expect(modifier?.kind).toBe("defense-ignore");
    if (modifier?.kind !== "defense-ignore" || modifier.valueExpression?.kind !== "rank") {
      throw new Error("Lux & Umbra DEF Ignore ratio expression missing.");
    }
    expect(modifier.valueExpression.values[1]).toBeCloseTo(0.08, 10);
  });
});
