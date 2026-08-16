import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import { calculateActionDamage, calculateTuneBreakDamage, calculateTuneRuptureDamage } from "@/domain/damage-engine";
import { compareExternalDisplay } from "@/domain/external-benchmark";
import { calculateActionLab, isStandardDamage, resolvePersonalLoadout } from "@/domain/personal-dps-lab";
import { aemeath, aemeathPreset } from "./aemeath";
import { aemeathNakedStandardBenchmarks, aemeathNakedTuneBenchmarks } from "./aemeath-external-benchmarks";

const action = (id: string) => aemeath.combat!.actions.find((candidate) => candidate.id === id)!;

describe("external benchmark fixtures — WutheringTools Aemeath", () => {
  it.each(aemeathNakedStandardBenchmarks)("matches $actionId displayed Normal/Average/Crit", (benchmark) => {
    const result = calculateActionDamage({
      action: action(benchmark.actionId), finalStats: benchmark.finalStats,
      attackerLevel: benchmark.characterLevel, scalingAttribute: "attack", element: "fusion",
      target: { level: benchmark.targetLevel, elementalResistance: { fusion: benchmark.targetResistance.elemental }, physicalResistance: benchmark.targetResistance.physical },
    });
    expect(result.status).toBe("supported");
    if (result.status !== "supported") return;
    const amounts = { normal: result.total.nonCrit, average: result.total.expected, crit: result.total.crit };
    for (const key of ["normal", "average", "crit"] as const) {
      expect(compareExternalDisplay(amounts[key], benchmark.expectedDisplayed[key], benchmark.displayRule)).toMatchObject({ matches: true, delta: 0 });
    }
  });

  it.each(aemeathNakedStandardBenchmarks.filter((item) => item.expectedDisplayedPerHit))(
    "preserves $actionId hit distribution as well as its raw total",
    (benchmark) => {
      const result = calculateActionDamage({
        action: action(benchmark.actionId), finalStats: benchmark.finalStats,
        attackerLevel: 90, scalingAttribute: "attack", element: "fusion",
        target: { level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1 },
      });
      if (result.status !== "supported") throw new Error(result.message);
      const hits = result.hitGroups.flatMap((group) => Array.from({ length: group.hits }, () => group.damagePerHit.nonCrit));
      expect(hits.map(Math.ceil)).toEqual(benchmark.expectedDisplayedPerHit);
      expect(result.hitGroups.reduce((sum, group) => sum + group.subtotal.nonCrit, 0)).toBeCloseTo(result.total.nonCrit, 12);
    },
  );

  it("keeps the qualified 4C Tune mismatch explicit without changing the constant", () => {
    const benchmark = aemeathNakedTuneBenchmarks.find((item) => item.actionId === "tune-break")!;
    const result = calculateTuneBreakDamage({ finalStats: benchmark.finalStats, attackerLevel: 90, enemyClass: "4C", target: { level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1 } });
    if (result.status !== "supported") throw new Error(result.message);
    expect(result.tuneEnemyBase).toBe(10027);
    expect(result.total.nonCrit).toBeCloseTo(79623.37519788918, 9);
    expect(compareExternalDisplay(result.total.nonCrit, 79625, "ceiling", 2)).toMatchObject({ displayed: 79624, delta: -1, matches: true });
  });

  it.each(aemeathNakedTuneBenchmarks.filter((item) => item.actionId !== "tune-break"))("matches $actionId independently", (benchmark) => {
    const result = calculateTuneRuptureDamage({ action: action(benchmark.actionId), finalStats: benchmark.finalStats, attackerLevel: 90, enemyClass: "4C", element: "fusion", target: { level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1 } });
    if (result.status !== "supported") throw new Error(result.message);
    expect(compareExternalDisplay(result.total.nonCrit, benchmark.expectedDisplayed.normal, "ceiling").matches).toBe(true);
  });
});

describe("real Game Data integration — Aemeath recommended build", () => {
  const build = createBuildFromPreset(aemeathPreset, { id: "real-build-benchmark", now: "2026-08-16T00:00:00Z" });
  const loadout = resolvePersonalLoadout(build);
  const target = { id: "real-build-target", level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1, tuneEnemyClass: "4C" as const };

  it("separates permanent panel accounting and each proven manual runtime effect", () => {
    const run = (actionId: string, manualEffectIds: string[] = []) => calculateActionLab({ loadout, actionId, stats: build.finalStats, target, manualEffectIds })!;
    const baseline = run("overdrive");
    const permanent = run("overdrive", ["everbright-r1-base", "trailblazing-2pc", "sigillum-main-aemeath"]);
    const everbright = run("overdrive", ["everbright-r1-liberation"]);
    const trailblazing = run("overdrive", ["trailblazing-5pc"]);
    const heavy = run("mech-heavy-2", ["before-all-sounds"]);
    if (![baseline, permanent, everbright, trailblazing, heavy].every((item) => isStandardDamage(item.damage))) throw new Error("Expected standard damage");
    if (!isStandardDamage(baseline.damage) || !isStandardDamage(permanent.damage) || !isStandardDamage(everbright.damage) || !isStandardDamage(trailblazing.damage) || !isStandardDamage(heavy.damage)) return;
    expect(permanent.damage.total).toEqual(baseline.damage.total);
    expect(everbright.damage).toMatchObject({ defenseIgnore: 0.32, resistanceIgnore: 0.1 });
    expect(trailblazing.damage.rawCritRatePercent).toBe(baseline.damage.rawCritRatePercent + 20);
    expect(trailblazing.damage.additionalElementalDamageBonusPercent).toBe(20);
    expect(trailblazing.damage.total.expected).toBeGreaterThan(baseline.damage.total.expected);
    expect(heavy.damage.damageAmplificationPercent).toBe(200);
  });
});

describe("talent-level readiness — Aemeath", () => {
  it("marks every current action family Lv10 verified and Lv1–9 unavailable", () => {
    expect(aemeath.combat!.level10Only).toBe(true);
    expect(new Set(aemeath.combat!.actions.map((entry) => entry.level))).toEqual(new Set([10]));
  });
});
