import { describe, expect, it } from "vitest";
import type { CombatAction, FinalStats } from "./models";
import {
  calculateActionDamage,
  calculateDefenseMultiplier,
  calculateResistanceMultiplier,
  DamageCalculationError,
  percentToRatio,
  type ScalingAttribute,
  type StandardDamageRequest,
} from "./damage-engine";

const source = { kind: "technical-fixture" as const, source: "Test" };
const unknown = { value: null, confidence: "unknown" as const };
const action = (
  multipliers: CombatAction["multipliers"] = [{ percent: 100, hits: 1 }],
): CombatAction => ({
  id: "test-action",
  name: "Test action",
  talent: "basicAttack",
  damageType: "basicAttack",
  level: 10,
  multipliers,
  castDurationSeconds: unknown,
  recoverySeconds: unknown,
  hitTimingsSeconds: unknown,
  source,
});
const stats = (patch: Partial<FinalStats> = {}): FinalStats => ({
  hp: 10000,
  attack: 2000,
  defense: 1000,
  critRate: 50,
  critDamage: 200,
  energyRegen: 100,
  healingBonus: 0,
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
  ...patch,
});
const request = (
  patch: Partial<StandardDamageRequest> = {},
): StandardDamageRequest => ({
  action: action(),
  finalStats: stats(),
  attackerLevel: 90,
  scalingAttribute: "attack",
  element: "fusion",
  target: { level: 90, elementalResistance: { fusion: 0 } },
  ...patch,
});
const supported = (input: StandardDamageRequest) => {
  const result = calculateActionDamage(input);
  expect(result.status).toBe("supported");
  if (result.status !== "supported") throw new Error(result.message);
  return result;
};

describe("Damage Engine V0.1", () => {
  it("convertit les pourcentages UI sans ajouter 1 au Crit DMG", () => {
    expect(percentToRatio(65)).toBe(0.65);
    expect(percentToRatio(250)).toBe(2.5);
    const result = supported(request());
    expect(result.critDamageMultiplier).toBe(2);
  });

  it.each([
    ["attack", 2000],
    ["hp", 10000],
    ["defense", 1000],
  ] as const)("supporte le scaling %s depuis finalStats", (scalingAttribute, value) => {
    const result = supported(
      request({ scalingAttribute: scalingAttribute as ScalingAttribute }),
    );
    expect(result.scalingAttributeValue).toBe(value);
    expect(result.baseAbilityDamage).toBe(value);
  });

  it("produit séparément non-crit, crit et espérance", () => {
    const result = supported(request());
    expect(result.total.crit).toBe(result.total.nonCrit * 2);
    expect(result.expectedCritMultiplier).toBe(1.5);
    expect(result.total.expected).toBe(result.total.nonCrit * 1.5);
  });

  it("borne le Crit Rate effectif mais conserve sa valeur brute", () => {
    const result = supported(
      request({
        finalStats: stats({ critRate: 130 }),
        modifiers: { critRateBonusPercent: 20 },
      }),
    );
    expect(result.rawCritRatePercent).toBe(150);
    expect(result.effectiveCritRate).toBe(1);
    expect(result.expectedCritMultiplier).toBe(result.critDamageMultiplier);
  });

  it("additionne les DMG Bonus puis multiplie séparément l'Amplification", () => {
    const finalStats = stats({
      elementalDamageBonus: { ...stats().elementalDamageBonus, fusion: 40 },
      damageTypeBonus: { ...stats().damageTypeBonus, basicAttack: 20 },
    });
    const result = supported(
      request({
        finalStats,
        modifiers: {
          allDamageBonusPercent: 10,
          additionalElementalDamageBonusPercent: 5,
          additionalDamageTypeBonusPercent: 3,
          damageAmplificationPercent: 25,
        },
      }),
    );
    expect(result.totalDamageBonusPercent).toBe(78);
    expect(result.damageBonusMultiplier).toBe(1.78);
    expect(result.damageAmplificationMultiplier).toBe(1.25);
    const withoutAmplification = supported(request({ finalStats, modifiers: {
      allDamageBonusPercent: 10,
      additionalElementalDamageBonusPercent: 5,
      additionalDamageTypeBonusPercent: 3,
    } }));
    expect(result.total.nonCrit).toBeCloseTo(
      withoutAmplification.total.nonCrit * 1.25,
      12,
    );
  });

  it("applique la formule DEF niveau 90 contre niveau 90", () => {
    const defense = calculateDefenseMultiplier(90, 90);
    expect(defense.attackerLevelTerm).toBe(1520);
    expect(defense.enemyBaseDefense).toBe(1512);
    expect(defense.multiplier).toBeCloseTo(1520 / (1520 + 1512), 12);
  });

  it("conserve DEF Reduction et DEF Ignore comme facteurs distincts", () => {
    const reduction = calculateDefenseMultiplier(90, 90, 0.2, 0);
    const ignore = calculateDefenseMultiplier(90, 90, 0, 0.3);
    const combined = calculateDefenseMultiplier(90, 90, 0.2, 0.3);
    expect(reduction.multiplier).toBeCloseTo(
      1520 / (1520 + 1512 * 0.8),
      12,
    );
    expect(ignore.multiplier).toBeCloseTo(
      1520 / (1520 + 1512 * 0.7),
      12,
    );
    expect(combined.multiplier).toBeCloseTo(
      1520 / (1520 + 1512 * 0.8 * 0.7),
      12,
    );
  });

  it.each([
    [0, 1],
    [0.1, 0.9],
    [-0.1, 1.05],
    [0.8, 0.2],
    [1, 1 / 6],
  ])("calcule le multiplicateur RES pour %s", (resistance, expected) => {
    expect(calculateResistanceMultiplier(resistance)).toBeCloseTo(expected, 12);
  });

  it("applique séparément RES Reduction et RES Ignore à l'élément demandé", () => {
    const result = supported(
      request({
        target: {
          level: 90,
          elementalResistance: { fusion: 0.2, glacio: 0.9 },
        },
        modifiers: { resistanceReduction: 0.1, resistanceIgnore: 0.05 },
      }),
    );
    expect(result.baseElementalResistance).toBe(0.2);
    expect(result.effectiveResistance).toBeCloseTo(0.05, 12);
    expect(result.resistanceMultiplier).toBeCloseTo(0.95, 12);
  });

  it("conserve chaque groupe et chaque hit d'une action multi-hit", () => {
    const result = supported(
      request({
        action: action([
          { percent: 10, hits: 3 },
          { percent: 25, hits: 1 },
        ]),
      }),
    );
    expect(result.hitCount).toBe(4);
    expect(result.hitGroups.map((group) => [
      group.motionValuePercentPerHit,
      group.hits,
      group.totalMotionValue,
    ])).toEqual([
      [10, 3, 0.30000000000000004],
      [25, 1, 0.25],
    ]);
    expect(result.totalMotionValue).toBeCloseTo(0.55, 12);
    expect(result.total.nonCrit).toBeCloseTo(
      result.hitGroups.reduce((sum, group) => sum + group.subtotal.nonCrit, 0),
      12,
    );
  });

  it("utilise l'effectiveDamageType fourni par le contexte", () => {
    const conditionalAction = {
      ...action(),
      damageType: "heavyAttack" as const,
      conditionalDamageType: {
        damageType: "resonanceLiberation" as const,
        condition: "État de test",
      },
    };
    const finalStats = stats({
      damageTypeBonus: {
        ...stats().damageTypeBonus,
        heavyAttack: 10,
        resonanceLiberation: 50,
      },
    });
    const result = supported(
      request({
        action: conditionalAction,
        finalStats,
        effectiveDamageType: "resonanceLiberation",
      }),
    );
    expect(result.baseDamageType).toBe("heavyAttack");
    expect(result.effectiveDamageType).toBe("resonanceLiberation");
    expect(result.damageTypeBonusPercent).toBe(50);
  });

  it("retourne unsupported pour Tune Amp au lieu d'inventer un scaling ATK", () => {
    const result = calculateActionDamage(
      request({ action: { ...action(), scaling: "tuneAmp" } }),
    );
    expect(result).toMatchObject({
      status: "unsupported",
      reason: "tune-amp-not-implemented",
    });
  });

  it("refuse les entrées produisant NaN, Infinity ou des dégâts négatifs", () => {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() =>
        calculateActionDamage(
          request({ finalStats: stats({ attack: invalid }) }),
        ),
      ).toThrowError(DamageCalculationError);
    }
    expect(() =>
      calculateActionDamage(
        request({ modifiers: { damageAmplificationPercent: -101 } }),
      ),
    ).toThrowError(DamageCalculationError);
  });
});
