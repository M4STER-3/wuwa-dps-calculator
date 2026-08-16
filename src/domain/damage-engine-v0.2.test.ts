import { describe, expect, it } from "vitest";
import { aemeath, aemeathPreset } from "@/data/aemeath";
import {
  AEMEATH_S6_TUNE_RUPTURE_CRIT,
  calculateTuneBreakDamage,
  calculateTuneRuptureDamage,
  rupturousTrailTuneAmp,
} from "./damage-engine";

const action = (id: string) =>
  aemeath.combat!.actions.find((candidate) => candidate.id === id)!;
const target90 = {
  level: 90,
  elementalResistance: { fusion: 0.1 },
  physicalResistance: 0.1,
};
const supported = <T extends { status: string }>(result: T) => {
  expect(result.status).toBe("supported");
  if (result.status !== "supported") throw new Error("Résultat inattendu");
  return result as Extract<T, { status: "supported" }>;
};

describe("Damage Engine V0.2 — Tune Break / Tune Rupture", () => {
  it("préserve les cross-checks Aemeath 4C niveau 90", () => {
    const common = {
      finalStats: aemeathPreset.finalStats,
      attackerLevel: 90,
      enemyClass: "4C" as const,
      target: target90,
    };
    const starburst = supported(calculateTuneRuptureDamage({
      ...common, action: action("starburst"), element: "fusion",
      context: { resonatorId: "aemeath", resonanceMode: "tune-rupture" },
    }));
    const seraphic = supported(calculateTuneRuptureDamage({
      ...common, action: action("seraphic-bonus"), element: "fusion",
    }));
    const tuneBreak = supported(calculateTuneBreakDamage(common));

    expect(starburst.total.nonCrit).toBeCloseTo(29681.106043298154, 9);
    expect(seraphic.total.nonCrit).toBeCloseTo(5441.760048680739, 9);
    expect(tuneBreak.total.nonCrit).toBeCloseTo(79623.37519788918, 9);
  });

  it("valide indépendamment Tune Break niveau 90 contre un ennemi niveau 100", () => {
    const result = supported(calculateTuneBreakDamage({
      finalStats: { ...aemeathPreset.finalStats, tuneBreakBoost: 0 },
      attackerLevel: 90,
      enemyClass: "4C",
      target: { level: 100, elementalResistance: { fusion: 0.99 }, physicalResistance: 0.2 },
    }));
    expect(result.total.nonCrit).toBeCloseTo(62688.082262210795, 9);
  });

  it("exige un multiplicateur vérifié hors niveau 90", () => {
    const base = { finalStats: aemeathPreset.finalStats, attackerLevel: 80, enemyClass: "1C" as const, target: target90 };
    expect(calculateTuneBreakDamage(base)).toMatchObject({ status: "unsupported", reason: "unsupported-tune-break-level" });
    expect(calculateTuneBreakDamage({ ...base, verifiedLevelMultiplier: 12 }).status).toBe("supported");
  });

  it("additionne 4 points de Tune AMP par stack Rupturous Trail", () => {
    expect(rupturousTrailTuneAmp(30)).toBe(120);
    const result = supported(calculateTuneRuptureDamage({
      action: action("seraphic-bonus"), finalStats: aemeathPreset.finalStats,
      attackerLevel: 90, enemyClass: "4C", element: "fusion", target: target90,
      additionalTuneAmpPercent: rupturousTrailTuneAmp(30),
    }));
    expect(result.tuneAmpPercent).toBeCloseTo(229.35, 12);
  });

  it("n'utilise pas le Crit normal à S0 et applique seulement l'override S6", () => {
    const request = { action: action("starburst"), finalStats: { ...aemeathPreset.finalStats, critRate: 100, critDamage: 999 }, attackerLevel: 90, enemyClass: "4C" as const, element: "fusion" as const, target: target90 };
    expect(supported(calculateTuneRuptureDamage(request)).expectedCritMultiplier).toBe(1);
    expect(supported(calculateTuneRuptureDamage({ ...request, critOverride: AEMEATH_S6_TUNE_RUPTURE_CRIT })).expectedCritMultiplier).toBeCloseTo(2.4, 12);
  });

  it("refuse Tune Rupture pour Aemeath en mode fusion-burst", () => {
    expect(calculateTuneRuptureDamage({
      action: action("starburst"), finalStats: aemeathPreset.finalStats,
      attackerLevel: 90, enemyClass: "4C", element: "fusion", target: target90,
      context: { resonatorId: "aemeath", resonanceMode: "fusion-burst" },
    })).toMatchObject({ status: "unsupported", reason: "invalid-resonance-mode" });
  });

  it.each(["defenseReduction", "defenseIgnore"] as const)(
    "%s modifie Tune Break sans fusionner les modificateurs DEF",
    (modifier) => {
      const baseline = supported(calculateTuneBreakDamage({
        finalStats: aemeathPreset.finalStats, attackerLevel: 90,
        enemyClass: "4C", target: target90,
      }));
      const result = supported(calculateTuneBreakDamage({
        finalStats: aemeathPreset.finalStats, attackerLevel: 90,
        enemyClass: "4C", target: target90, modifiers: { [modifier]: 0.2 },
      }));
      expect(result.total.nonCrit).toBeGreaterThan(baseline.total.nonCrit);
      expect(result[modifier]).toBe(0.2);
      expect(result[modifier === "defenseReduction" ? "defenseIgnore" : "defenseReduction"]).toBe(0);
    },
  );

  it.each(["defenseReduction", "defenseIgnore"] as const)(
    "%s modifie Tune Rupture sans fusionner les modificateurs DEF",
    (modifier) => {
      const base = {
        action: action("starburst"), finalStats: aemeathPreset.finalStats,
        attackerLevel: 90, enemyClass: "4C" as const,
        element: "fusion" as const, target: target90,
      };
      const baseline = supported(calculateTuneRuptureDamage(base));
      const result = supported(calculateTuneRuptureDamage({
        ...base, modifiers: { [modifier]: 0.2 },
      }));
      expect(result.total.nonCrit).toBeGreaterThan(baseline.total.nonCrit);
      expect(result[modifier]).toBe(0.2);
      expect(result[modifier === "defenseReduction" ? "defenseIgnore" : "defenseReduction"]).toBe(0);
    },
  );

  it.each(["resistanceReduction", "resistanceIgnore"] as const)(
    "%s s'applique uniquement à la résistance physique de Tune Break",
    (modifier) => {
      const result = supported(calculateTuneBreakDamage({
        finalStats: aemeathPreset.finalStats, attackerLevel: 90,
        enemyClass: "4C",
        target: { ...target90, elementalResistance: { fusion: 0.9 } },
        modifiers: { [modifier]: 0.05 },
      }));
      expect(result.baseResistance).toBe(0.1);
      expect(result.effectiveResistance).toBeCloseTo(0.05, 12);
      expect(result[modifier]).toBe(0.05);
    },
  );

  it.each(["resistanceReduction", "resistanceIgnore"] as const)(
    "%s s'applique à la résistance élémentaire de Tune Rupture",
    (modifier) => {
      const result = supported(calculateTuneRuptureDamage({
        action: action("starburst"), finalStats: aemeathPreset.finalStats,
        attackerLevel: 90, enemyClass: "4C", element: "fusion",
        target: { ...target90, physicalResistance: 0.9 },
        modifiers: { [modifier]: 0.05 },
      }));
      expect(result.baseResistance).toBe(0.1);
      expect(result.effectiveResistance).toBeCloseTo(0.05, 12);
      expect(result[modifier]).toBe(0.05);
    },
  );

  it("additionne le Tune Break Boost permanent et temporaire pour les deux formules", () => {
    const modifiers = { temporaryTuneBreakBoostPercent: 20 };
    const tuneBreak = supported(calculateTuneBreakDamage({
      finalStats: aemeathPreset.finalStats, attackerLevel: 90,
      enemyClass: "4C", target: target90, modifiers,
    }));
    const tuneRupture = supported(calculateTuneRuptureDamage({
      action: action("starburst"), finalStats: aemeathPreset.finalStats,
      attackerLevel: 90, enemyClass: "4C", element: "fusion",
      target: target90, modifiers,
    }));
    for (const result of [tuneBreak, tuneRupture]) {
      expect(result.permanentTuneBreakBoostPercent).toBe(10);
      expect(result.temporaryTuneBreakBoostPercent).toBe(20);
      expect(result.effectiveTuneBreakBoostPercent).toBe(30);
      expect(result.tuneBreakBoostMultiplier).toBeCloseTo(1.3, 12);
    }
  });
});
