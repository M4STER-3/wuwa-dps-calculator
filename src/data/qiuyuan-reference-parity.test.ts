import { describe, expect, it } from "vitest";
import { calculateActionDamage } from "@/domain/damage-engine";
import type { FinalStats } from "@/domain/models";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { QIUYUAN_MANUAL, QIUYUAN_NATIVE } from "./precise-dps-qiuyuan-core";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1259,
  critRate: 50,
  critDamage: 200,
  energyRegen: 125,
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

const resonator = findPreciseDpsResonator("qiuyuan")!;
const weapon = findPreciseDpsWeapon("qiuyuan")!;
const action = (id: string) =>
  resonator.combat?.actions.find((entry) => entry.id === id);

describe("Qiuyuan current-reference formula parity", () => {
  it("resolves Straw Cape's reviewed 500% ATK Echo Skill hit through the universal standard formula", () => {
    const resolved = resolveActionTalentLevel(action(QIUYUAN_MANUAL.strawCape)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 500, hits: 1 }]);
    expect(resolved.action.scalingAttribute).toBe("attack");
    expect(resolved.action.damageType).toBe("echoSkill");

    const damage = calculateActionDamage({
      action: resolved.action,
      finalStats: stats,
      attackerLevel: 90,
      scalingAttribute: "attack",
      element: "aero",
      target: {
        level: 90,
        elementalResistance: { aero: 0.1 },
        physicalResistance: 0.1,
      },
    });

    expect(damage.status).toBe("supported");
    if (damage.status !== "supported") return;
    expect(damage.totalMotionValue).toBeCloseTo(5, 8);
    expect(damage.defenseMultiplier).toBeCloseTo(1520 / 3032, 10);
    expect(damage.resistanceMultiplier).toBeCloseTo(0.9, 10);
    expect(damage.total.nonCrit).toBeCloseTo(4511.873350923483, 8);
  });

  it("keeps S3/S5 and Emerald Sentence runtime semantics outside permanent panel stats", () => {
    const sequence = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-qiuyuan-sequence-passives",
    )?.structuredEffect;
    const s3 = sequence?.rules.find(
      (rule) => rule.id === "qiuyuan-s3-liberation-multiplier",
    );
    const s5 = sequence?.rules.find(
      (rule) => rule.id === "qiuyuan-s5-defense-ignore",
    );
    expect(s3?.requiredSequence).toBe(3);
    expect(s3?.accounting).toBe("runtime");
    expect(s3?.modifiers).toContainEqual({
      kind: "motion-value",
      mode: "relative-additive",
      stacking: "additive",
      value: { kind: "constant", value: 500 },
    });
    expect(s5?.requiredSequence).toBe(5);
    expect(s5?.accounting).toBe("runtime");
    expect(s5?.modifiers).toContainEqual({
      kind: "defense-ignore",
      stacking: "additive",
      value: 0.15,
    });

    const permanent = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-emerald-sentence-permanent",
    )?.structuredEffect;
    const cleaver = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-emerald-sentence-bamboo-cleaver",
    )?.structuredEffect;
    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(cleaver?.lifecycle?.refresh).toBe("no-reset-at-max-stacks");
    expect(cleaver?.lifecycle?.stacks).toEqual({ kind: "shared", max: 2, initial: 0 });
    expect(cleaver?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);

    expect(action(QIUYUAN_NATIVE.liberation)?.damageType).toBe("echoSkill");
  });
});
