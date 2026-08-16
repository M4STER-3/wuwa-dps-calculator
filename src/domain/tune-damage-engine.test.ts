import { describe, expect, it } from "vitest";
import type { CombatAction, FinalStats } from "./models";
import {
  calculateEffectiveTuneAmpPercent,
  calculateTuneAmpIncrease,
  calculateTuneBreakDamage,
  calculateTuneRuptureDamage,
  tuneEnemyBaseByCost,
  type TuneDamageOwner,
} from "./damage-engine";

const source = { kind: "technical-fixture" as const, source: "Test" };
const unknown = { value: null, confidence: "unknown" as const };
const tuneAction = (percent = 596.43): CombatAction => ({
  id: "tune-action",
  name: "Tune action",
  talent: "forteCircuit",
  damageType: "tuneRupture",
  scaling: "tuneAmp",
  level: 10,
  multipliers: [{ percent, hits: 1 }],
  castDurationSeconds: unknown,
  recoverySeconds: unknown,
  hitTimingsSeconds: unknown,
  source,
});
const finalStats = (patch: Partial<FinalStats> = {}): FinalStats => ({
  hp: 15000,
  attack: 2000,
  defense: 1100,
  critRate: 65,
  critDamage: 210,
  energyRegen: 115,
  healingBonus: 0,
  tuneBreakBoost: 10,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 40,
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
const owner = (
  patch: Partial<TuneDamageOwner> = {},
): TuneDamageOwner => ({
  resonatorId: "owner",
  level: 90,
  finalStats: finalStats(),
  resonanceMode: "tune-rupture",
  ...patch,
});
const supported = <T extends { status: string }>(result: T) => {
  expect(result.status).toBe("supported");
  if (result.status !== "supported") throw new Error("Résultat non supporté");
  return result;
};

describe("Damage Engine V0.2 — dégâts Tune", () => {
  it("publie les bases empiriques 1C, 3C et 4C", () => {
    expect(tuneEnemyBaseByCost).toEqual({ 1: 716, 3: 2149, 4: 10027 });
  });

  it("utilise automatiquement le multiplicateur Tune Break Lv90 = 16", () => {
    const result = supported(
      calculateTuneBreakDamage({
        owner: owner(),
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: {}, physicalResistance: 0.1 },
      }),
    );
    if (result.status !== "supported" || result.formula !== "tune-break-v0.2") return;
    expect(result.tuneBreakLevelMultiplier).toBe(16);
    expect(result.tuneBreakBoostMultiplier).toBe(1.1);
    expect(result.physicalResistanceMultiplier).toBe(0.9);
    const expected =
      10027 * 16 * (1520 / (1520 + 1512)) * 0.9 * 1.1;
    expect(result.damage.nonCrit).toBeCloseTo(expected, 8);
    expect(result.damage.crit).toBe(result.damage.nonCrit);
    expect(result.damage.expected).toBe(result.damage.nonCrit);
    expect(result.canCrit).toBe(false);
  });

  it("refuse un niveau non vérifié mais accepte un multiplicateur explicite", () => {
    const unsupported = calculateTuneBreakDamage({
      owner: owner({ level: 80 }),
      tuneEnemyCost: 3,
      target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
    });
    expect(unsupported).toMatchObject({
      status: "unsupported",
      reason: "tune-break-level-multiplier-unverified",
    });
    const explicit = supported(
      calculateTuneBreakDamage({
        owner: owner({ level: 80 }),
        tuneEnemyCost: 3,
        verifiedLevelMultiplier: 12,
        target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
      }),
    );
    if (explicit.status !== "supported" || explicit.formula !== "tune-break-v0.2") return;
    expect(explicit.tuneBreakLevelMultiplier).toBe(12);
  });

  it("Tune Break ignore ATK, Crit et les bonus élémentaires standards", () => {
    const calculate = (stats: FinalStats) =>
      calculateTuneBreakDamage({
        owner: owner({ finalStats: stats }),
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: { fusion: 0.9 }, physicalResistance: 0.1 },
      });
    const baseline = supported(calculate(finalStats()));
    const changed = supported(
      calculate(
        finalStats({
          attack: 99999,
          critRate: 999,
          critDamage: 999,
          elementalDamageBonus: {
            ...finalStats().elementalDamageBonus,
            fusion: 999,
          },
        }),
      ),
    );
    if (baseline.status !== "supported" || baseline.formula !== "tune-break-v0.2") return;
    if (changed.status !== "supported" || changed.formula !== "tune-break-v0.2") return;
    expect(changed.damage).toEqual(baseline.damage);
    expect(baseline.physicalResistance).toBe(0.1);
  });

  it("Tune Break applique TBB temporaire, DEF Reduction et DEF Ignore", () => {
    const baseline = supported(
      calculateTuneBreakDamage({
        owner: owner(),
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
      }),
    );
    const modified = supported(
      calculateTuneBreakDamage({
        owner: owner(),
        tuneEnemyCost: 4,
        temporaryTuneBreakBoostPercent: 20,
        target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
        modifiers: { defenseReduction: 0.2, defenseIgnore: 0.3 },
      }),
    );
    if (baseline.status !== "supported" || baseline.formula !== "tune-break-v0.2") return;
    if (modified.status !== "supported" || modified.formula !== "tune-break-v0.2") return;
    expect(modified.effectiveTuneBreakBoostPercent).toBe(30);
    expect(modified.tuneBreakBoostMultiplier).toBe(1.3);
    expect(modified.defenseMultiplier).toBeGreaterThan(baseline.defenseMultiplier);
  });

  it("reproduit le cross-check communautaire Lv90 contre ennemi Lv100", () => {
    const result = supported(
      calculateTuneBreakDamage({
        owner: owner({ finalStats: finalStats({ tuneBreakBoost: 0 }) }),
        tuneEnemyCost: 4,
        target: { level: 100, elementalResistance: {}, physicalResistance: 0.2 },
      }),
    );
    if (result.status !== "supported" || result.formula !== "tune-break-v0.2") return;
    const expected = 10027 * 16 * (190 / (190 + 199)) * 0.8;
    expect(result.damage.nonCrit).toBeCloseTo(expected, 8);
  });

  it("calcule Starburst et Seraphic Bonus avec la formule Tune Rupture", () => {
    const calculate = (percent: number) =>
      supported(
        calculateTuneRuptureDamage({
          action: tuneAction(percent),
          owner: owner(),
          element: "fusion",
          tuneEnemyCost: 4,
          target: { level: 90, elementalResistance: { fusion: 0.1 } },
        }),
      );
    const starburst = calculate(596.43);
    const seraphic = calculate(109.35);
    if (starburst.status !== "supported" || starburst.formula !== "tune-rupture-v0.2") return;
    if (seraphic.status !== "supported" || seraphic.formula !== "tune-rupture-v0.2") return;
    const common = 10027 * (1520 / (1520 + 1512)) * 0.9 * 1.1;
    expect(starburst.damagePerInstance.nonCrit).toBeCloseTo(
      common * 5.9643,
      8,
    );
    expect(seraphic.damagePerInstance.nonCrit).toBeCloseTo(
      common * 1.0935,
      8,
    );
  });

  it("Tune Rupture dépend de la RES Fusion mais pas d'ATK, Crit ou Fusion DMG Bonus", () => {
    const calculate = (stats: FinalStats, fusionResistance: number) =>
      supported(
        calculateTuneRuptureDamage({
          action: tuneAction(),
          owner: owner({ finalStats: stats }),
          element: "fusion",
          tuneEnemyCost: 4,
          target: {
            level: 90,
            elementalResistance: { fusion: fusionResistance },
          },
        }),
      );
    const baseline = calculate(finalStats(), 0.1);
    const standardStatsChanged = calculate(
      finalStats({
        attack: 99999,
        critRate: 100,
        critDamage: 999,
        elementalDamageBonus: {
          ...finalStats().elementalDamageBonus,
          fusion: 999,
        },
      }),
      0.1,
    );
    const lowerResistance = calculate(finalStats(), 0);
    if (baseline.status !== "supported" || baseline.formula !== "tune-rupture-v0.2") return;
    if (standardStatsChanged.status !== "supported" || standardStatsChanged.formula !== "tune-rupture-v0.2") return;
    if (lowerResistance.status !== "supported" || lowerResistance.formula !== "tune-rupture-v0.2") return;
    expect(standardStatsChanged.damagePerInstance).toEqual(
      baseline.damagePerInstance,
    );
    expect(lowerResistance.damagePerInstance.nonCrit).toBeGreaterThan(
      baseline.damagePerInstance.nonCrit,
    );
    expect(baseline.critMode).toBe("disabled");
    expect(baseline.damagePerInstance.crit).toBe(
      baseline.damagePerInstance.nonCrit,
    );
  });

  it("applique uniquement un Crit override fixe Aemeath S6 80/275", () => {
    const result = supported(
      calculateTuneRuptureDamage({
        action: tuneAction(),
        owner: owner(),
        element: "fusion",
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: { fusion: 0.1 } },
        critOverride: {
          critRate: 0.8,
          critDamageMultiplier: 2.75,
          source: "Aemeath S6 — Resonance Mode - Tune Rupture",
        },
      }),
    );
    if (result.status !== "supported" || result.formula !== "tune-rupture-v0.2") return;
    expect(result.critMode).toBe("fixed-override");
    expect(result.critRate).toBe(0.8);
    expect(result.critDamageMultiplier).toBe(2.75);
    expect(result.expectedCritMultiplier).toBeCloseTo(2.4, 12);
    expect(result.damagePerInstance.crit).toBeCloseTo(
      result.damagePerInstance.nonCrit * 2.75,
      10,
    );
  });

  it("additionne les augmentations Tune AMP et accepte un nombre explicite d'instances", () => {
    const trailIncrease = calculateTuneAmpIncrease(4, 30);
    expect(trailIncrease).toBe(120);
    expect(calculateEffectiveTuneAmpPercent(109.35, trailIncrease)).toBeCloseTo(
      229.35,
      12,
    );
    const result = supported(
      calculateTuneRuptureDamage({
        action: tuneAction(109.35),
        owner: owner(),
        element: "fusion",
        tuneEnemyCost: 4,
        additionalTuneAmpPercent: trailIncrease,
        instances: 3,
        target: { level: 90, elementalResistance: { fusion: 0.1 } },
      }),
    );
    if (result.status !== "supported" || result.formula !== "tune-rupture-v0.2") return;
    expect(result.effectiveTuneAmpPercent).toBeCloseTo(229.35, 12);
    expect(result.total.nonCrit).toBeCloseTo(
      result.damagePerInstance.nonCrit * 3,
      10,
    );
  });

  it("ne mélange jamais Fusion Burst et Tune Rupture", () => {
    const result = calculateTuneRuptureDamage({
      action: tuneAction(),
      owner: owner({ resonanceMode: "fusion-burst" }),
      element: "fusion",
      tuneEnemyCost: 4,
      target: { level: 90, elementalResistance: { fusion: 0.1 } },
    });
    expect(result).toMatchObject({
      status: "unsupported",
      reason: "wrong-resonance-mode",
    });
  });

  it("retourne unsupported sans base Tune et rejette les valeurs non finies", () => {
    expect(
      calculateTuneBreakDamage({
        owner: owner(),
        target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
      }),
    ).toMatchObject({
      status: "unsupported",
      reason: "missing-tune-enemy-base",
    });
    expect(() =>
      calculateTuneBreakDamage({
        owner: owner({ finalStats: finalStats({ tuneBreakBoost: Number.NaN }) }),
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
      }),
    ).toThrow(/nombre fini/);
    expect(() =>
      calculateTuneRuptureDamage({
        action: tuneAction(Number.POSITIVE_INFINITY),
        owner: owner(),
        element: "fusion",
        tuneEnemyCost: 4,
        target: { level: 90, elementalResistance: { fusion: 0.1 } },
      }),
    ).toThrow(/nombre fini/);
  });
});
