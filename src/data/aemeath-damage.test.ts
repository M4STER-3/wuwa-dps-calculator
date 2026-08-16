import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import { calculateActionDamage } from "@/domain/damage-engine";
import { aemeath, aemeathPreset } from "./aemeath";

const build = createBuildFromPreset(aemeathPreset, {
  id: "aemeath-damage-validation",
  now: "2026-08-16T00:00:00.000Z",
});
const action = (id: string) =>
  aemeath.combat!.actions.find((candidate) => candidate.id === id)!;
const calculate = (actionId: string) => {
  const result = calculateActionDamage({
    action: action(actionId),
    finalStats: build.finalStats,
    attackerLevel: build.characterLevel,
    scalingAttribute: "attack",
    element: aemeath.element,
    target: { level: 90, elementalResistance: { fusion: 0 } },
  });
  expect(result.status).toBe("supported");
  if (result.status !== "supported") throw new Error(result.message);
  return result;
};

describe("validation réelle des dégâts individuels d'Aemeath", () => {
  it("ventile Basic Attack Stage 1 depuis finalStats et une cible contrôlée", () => {
    const result = calculate("aemeath-basic-1");
    const motionValue = 46.35 / 100;
    const baseAbilityDamage = build.finalStats.attack * motionValue;
    const damageBonusMultiplier =
      1 +
      (build.finalStats.elementalDamageBonus.fusion +
        build.finalStats.damageTypeBonus.basicAttack) /
        100;
    const defenseMultiplier = (800 + 8 * build.characterLevel) /
      ((800 + 8 * build.characterLevel) + (8 * 90 + 792));
    const nonCrit =
      baseAbilityDamage * damageBonusMultiplier * defenseMultiplier;
    const critMultiplier = build.finalStats.critDamage / 100;
    const expectedCritMultiplier =
      1 +
      (build.finalStats.critRate / 100) * (critMultiplier - 1);

    expect(result).toMatchObject({
      scalingAttribute: "attack",
      scalingAttributeValue: build.finalStats.attack,
      elementalDamageBonusPercent: build.finalStats.elementalDamageBonus.fusion,
      damageTypeBonusPercent: build.finalStats.damageTypeBonus.basicAttack,
      damageAmplificationMultiplier: 1,
      resistanceMultiplier: 1,
      hitCount: 1,
    });
    expect(result.totalMotionValue).toBeCloseTo(motionValue, 12);
    expect(result.baseAbilityDamage).toBeCloseTo(baseAbilityDamage, 12);
    expect(result.damageBonusMultiplier).toBeCloseTo(damageBonusMultiplier, 12);
    expect(result.defenseMultiplier).toBeCloseTo(defenseMultiplier, 12);
    expect(result.total.nonCrit).toBeCloseTo(nonCrit, 12);
    expect(result.critDamageMultiplier).toBeCloseTo(critMultiplier, 12);
    expect(result.total.crit).toBeCloseTo(nonCrit * critMultiplier, 12);
    expect(result.expectedCritMultiplier).toBeCloseTo(
      expectedCritMultiplier,
      12,
    );
    expect(result.total.expected).toBeCloseTo(
      nonCrit * expectedCritMultiplier,
      12,
    );
  });

  it("préserve les trois groupes et cinq hits de Basic Attack Stage 3", () => {
    const result = calculate("aemeath-basic-3");
    const sourceMultipliers = action("aemeath-basic-3").multipliers;

    expect(result.hitCount).toBe(5);
    expect(result.hitGroups.map((group) => ({
      percent: group.motionValuePercentPerHit,
      hits: group.hits,
    }))).toEqual(sourceMultipliers);
    expect(result.totalMotionValue).toBeCloseTo(
      sourceMultipliers.reduce(
        (total, group) => total + (group.percent / 100) * group.hits,
        0,
      ),
      12,
    );
    expect(result.total.nonCrit).toBeCloseTo(
      result.hitGroups.reduce(
        (total, group) => total + group.subtotal.nonCrit,
        0,
      ),
      12,
    );
  });

  it("refuse explicitement Starburst Tune Amp", () => {
    const result = calculateActionDamage({
      action: action("starburst"),
      finalStats: build.finalStats,
      attackerLevel: build.characterLevel,
      scalingAttribute: "attack",
      element: aemeath.element,
      target: { level: 90, elementalResistance: { fusion: 0 } },
    });
    expect(result).toMatchObject({
      status: "unsupported",
      actionId: "starburst",
      reason: "tune-amp-not-implemented",
    });
  });
});
