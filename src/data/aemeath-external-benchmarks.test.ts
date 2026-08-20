import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import { calculateActionDamage, calculateTuneBreakDamage, calculateTuneRuptureDamage } from "@/domain/damage-engine";
import { compareExternalDisplay } from "@/domain/external-benchmark";
import { calculateActionLab, isStandardDamage, resolvePersonalLoadout, simulateRotationLab } from "@/domain/personal-dps-lab";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { findPersonalRotationScenario } from "./personal-rotation-presets";
import { aemeath, aemeathPreset } from "./aemeath-combat";
import { aemeathNakedStandardBenchmarks, aemeathNakedTuneBenchmarks, nakedAemeathLevel90Stats } from "./aemeath-external-benchmarks";

const action = (id: string) => aemeath.combat!.actions.find((candidate) => candidate.id === id)!;
const structuredEffects = () => aemeath.combat!.effects.flatMap((effect) => effect.structuredEffect ? [effect.structuredEffect] : []);
const structuredEffect = (id: string) => structuredEffects().find((effect) => effect.id === id)!;
const rule = (effectId: string, ruleId: string) => structuredEffect(effectId).rules.find((candidate) => candidate.id === ruleId)!;
const target = { id: "aemeath-wutheringtools-target", level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1, tuneEnemyClass: "4C" as const };
const display = (result: { total: { nonCrit: number; expected: number; crit: number } }) => [
  Math.ceil(result.total.nonCrit),
  Math.ceil(result.total.expected),
  Math.ceil(result.total.crit),
];
const loadoutAtSequence = (sequence: 2 | 3 | 6) => {
  const build = createBuildFromPreset(
    { ...aemeathPreset, sequence },
    { id: `aemeath-wutheringtools-s${sequence}`, now: "2026-08-20T19:45:00Z" },
  );
  return { build, loadout: resolvePersonalLoadout(build) };
};

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
  const build = createBuildFromPreset(aemeathPreset, { id: "real-build-benchmark", now: "2026-08-20T00:00:00Z" });
  const loadout = resolvePersonalLoadout(build);
  const realBuildTarget = { id: "real-build-target", level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1, tuneEnemyClass: "4C" as const };

  it("separates permanent panel accounting and each proven manual runtime effect", () => {
    const run = (actionId: string, manualEffectIds: string[] = []) => calculateActionLab({ loadout, actionId, stats: build.finalStats, target: realBuildTarget, manualEffectIds })!;
    const baseline = run("overdrive");
    const permanent = run("overdrive", ["everbright-r1-base", "trailblazing-2pc", "sigillum-main-aemeath"]);
    const everbright = run("overdrive", ["everbright-r1-liberation"]);
    const trailblazing = run("overdrive", ["trailblazing-5pc"]);
    const heavy = run("mech-heavy-2", ["scenario-aemeath-instant-response-heavy"]);
    if (![baseline, permanent, everbright, trailblazing, heavy].every((item) => isStandardDamage(item.damage))) throw new Error("Expected standard damage");
    if (!isStandardDamage(baseline.damage) || !isStandardDamage(permanent.damage) || !isStandardDamage(everbright.damage) || !isStandardDamage(trailblazing.damage) || !isStandardDamage(heavy.damage)) return;
    expect(permanent.damage.allDamageBonusPercent).toBe(12);
    expect(permanent.damage.additionalElementalDamageBonusPercent).toBe(10);
    expect(permanent.damage.additionalDamageTypeBonusPercent).toBe(25);
    expect(permanent.damage.total.expected).toBeGreaterThan(baseline.damage.total.expected);
    expect(everbright.damage).toMatchObject({ defenseIgnore: 0.32, resistanceIgnore: 0.1 });
    expect(trailblazing.damage.rawCritRatePercent).toBe(baseline.damage.rawCritRatePercent + 20);
    expect(trailblazing.damage.additionalElementalDamageBonusPercent).toBe(20);
    expect(trailblazing.damage.total.expected).toBeGreaterThan(baseline.damage.total.expected);
    expect(heavy.damage.damageAmplificationPercent).toBe(200);
    expect(action("aemeath-heavy-2").damageType).toBe("resonanceLiberation");
    expect(action("mech-heavy-2").damageType).toBe("resonanceLiberation");
  });
});

describe("talent-level readiness — Aemeath", () => {
  it("resolves every configurable damaging action at exact Lv1-Lv10 without interpolation", () => {
    expect(aemeath.combat!.level10Only).toBe(false);
    const scalable = aemeath.combat!.actions.filter((entry) => entry.multipliers.length > 0 && entry.id !== "aemeath-fusion-burst");
    for (const entry of scalable) {
      expect(Object.keys(entry.multipliersByTalentLevel ?? {}), entry.id).toHaveLength(10);
      for (let level = 1; level <= 10; level += 1) {
        expect(resolveActionTalentLevel(entry, level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10).status, `${entry.id} Lv${level}`).toBe("supported");
      }
    }
  });

  it("matches current Lv1 reference rows across Basic, Skill, Forte and Intro", () => {
    expect(resolveActionTalentLevel(action("aemeath-basic-1"), 1)).toMatchObject({ status: "supported", action: { multipliers: [{ percent: 23.31, hits: 1 }] } });
    expect(resolveActionTalentLevel(action("armament-merge"), 1)).toMatchObject({ status: "supported", action: { multipliers: [{ percent: 13.54, hits: 1 }, { percent: 20.31, hits: 1 }, { percent: 33.85, hits: 1 }] } });
    expect(resolveActionTalentLevel(action("starburst"), 1)).toMatchObject({ status: "supported", action: { multipliers: [{ percent: 300, hits: 1 }] } });
    expect(resolveActionTalentLevel(action("seraphic-bonus"), 1)).toMatchObject({ status: "supported", action: { multipliers: [{ percent: 55, hits: 1 }] } });
    expect(resolveActionTalentLevel(action("intro-normal"), 1)).toMatchObject({ status: "supported", action: { multipliers: [{ percent: 6.77, hits: 2 }, { percent: 54.16, hits: 1 }] } });
  });
});

describe("WutheringTools multi-config mechanic parity — Aemeath", () => {
  it("matches S2 Seraphic Duet damage derived from the current WutheringTools naked profile", () => {
    const { loadout } = loadoutAtSequence(2);
    for (const actionId of ["seraphic-encore", "seraphic-overture"]) {
      const result = calculateActionLab({
        loadout,
        actionId,
        stats: nakedAemeathLevel90Stats,
        target,
        manualEffectIds: ["aemeath-sequence-personal-runtime"],
      })!;
      if (!isStandardDamage(result.damage)) throw new Error(`Expected standard damage for ${actionId}`);
      expect(display(result.damage)).toEqual([1373, 1407, 2059]);
    }
  });

  it("matches S3 Overdrive and Finale multiplier outputs from the current WutheringTools formula", () => {
    const { loadout } = loadoutAtSequence(3);
    const overdrive = calculateActionLab({
      loadout,
      actionId: "overdrive",
      stats: nakedAemeathLevel90Stats,
      target,
      manualEffectIds: ["aemeath-sequence-personal-runtime"],
    })!;
    const finale = calculateActionLab({
      loadout,
      actionId: "finale",
      stats: nakedAemeathLevel90Stats,
      target,
      manualEffectIds: ["aemeath-sequence-personal-runtime"],
    })!;
    if (!isStandardDamage(overdrive.damage) || !isStandardDamage(finale.damage)) throw new Error("Expected standard S3 damage");
    expect(display(overdrive.damage)).toEqual([2696, 2763, 4044]);
    expect(display(finale.damage)).toEqual([6863, 7034, 10294]);
  });

  it("matches S3 Between the Stars replacement on Finale in Fusion mode", () => {
    const { loadout } = loadoutAtSequence(3);
    const finale = calculateActionLab({
      loadout,
      actionId: "finale",
      stats: nakedAemeathLevel90Stats,
      target,
      resonanceMode: "fusion-burst",
      manualEffectIds: [
        "aemeath-sequence-personal-runtime",
        "aemeath-between-stars-personal-runtime",
      ],
    })!;
    if (!isStandardDamage(finale.damage)) throw new Error("Expected standard S3 Finale damage");
    expect(display(finale.damage)).toEqual([8578, 9050, 18013]);
  });

  it("matches S3 Tune and Fusion replacement values and Heavy II mode application", () => {
    expect(rule("aemeath-sequence-personal-runtime", "aemeath-s3-overdrive-mv")).toMatchObject({ requiredSequence: 3, modifiers: [{ kind: "motion-value", mode: "relative-additive", value: { kind: "constant", value: 40 } }] });
    expect(rule("aemeath-sequence-personal-runtime", "aemeath-s3-finale-mv")).toMatchObject({ requiredSequence: 3, modifiers: [{ kind: "motion-value", mode: "relative-additive", value: { kind: "constant", value: 100 } }] });
    expect(rule("aemeath-between-stars-personal-runtime", "between-stars-s3-replacement")).toMatchObject({ requiredSequence: 3, modifiers: [{ kind: "crit-damage-bonus", value: 60 }] });
    expect(rule("aemeath-between-stars-personal-runtime", "between-stars-s3-finale")).toMatchObject({ requiredSequence: 3, modifiers: [{ kind: "damage-amplification", value: 25 }] });
    for (const mode of ["tune-rupture", "fusion-burst"] as const) {
      const scenario = findPersonalRotationScenario("aemeath", mode)!;
      expect(scenario.specialEvents).toContainEqual(expect.objectContaining({ id: `aemeath-${mode}-s3-heavy-application`, kind: mode, minimumSequence: 3, anchor: expect.objectContaining({ stepIndex: 13, at: "end" }) }));
    }
  });

  it("scopes S6 fixed Crit to Fusion Burst only and keeps Tune Rupture non-critting", () => {
    const fixedCritRule = rule("aemeath-sequence-personal-runtime", "aemeath-s6-mode-fixed-crit");
    expect(fixedCritRule).toMatchObject({
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: ["aemeath-fusion-burst"] }],
      modifiers: [{ kind: "fixed-crit-override", critRatePercent: 80, critDamagePercent: 275 }],
    });

    const { loadout } = loadoutAtSequence(6);
    for (const actionId of ["starburst", "seraphic-bonus"]) {
      const result = calculateActionLab({
        loadout,
        actionId,
        stats: nakedAemeathLevel90Stats,
        target,
        resonanceMode: "tune-rupture",
        manualEffectIds: ["aemeath-sequence-personal-runtime"],
      })!;
      expect(result.damage.total.nonCrit).toBeCloseTo(result.damage.total.crit, 12);
      expect(result.damage.total.nonCrit).toBeCloseTo(result.damage.total.expected, 12);
    }
  });

  it("applies the S6 80/275 fixed Crit to every emitted Fusion Burst damage event", () => {
    const { build, loadout } = loadoutAtSequence(6);
    const simulation = simulateRotationLab(loadout, nakedAemeathLevel90Stats, target, "fusion-burst");
    if (!simulation) throw new Error("Expected Aemeath Fusion simulation");
    const bursts = simulation.audits.filter((audit) => audit.actionId === "aemeath-fusion-burst");
    expect(bursts.length).toBeGreaterThan(0);
    for (const burst of bursts) {
      if (burst.damage.formula !== "negative-status-v0.2") {
        throw new Error("Expected Fusion Burst negative-status damage");
      }
      expect(burst.damage.effectiveCritRate).toBe(0.8);
      expect(burst.damage.critDamageMultiplier).toBe(2.75);
      expect(burst.damage.expectedCritMultiplier).toBeCloseTo(2.4, 12);
    }
    expect(build.sequence).toBe(6);
  });

  it("matches S6 Liberation vulnerability and trail-mode payloads", () => {
    expect(rule("aemeath-sequence-personal-runtime", "aemeath-s6-liberation-amplification")).toMatchObject({ requiredSequence: 6, modifiers: [{ kind: "damage-amplification", value: 40 }] });
    const tune = findPersonalRotationScenario("aemeath", "tune-rupture")!;
    expect(tune.specialEvents?.find((event) => event.id === "aemeath-seraphic-encore-bonus")).toMatchObject({ repeat: 10 });
    expect(tune.specialEvents?.find((event) => event.id === "aemeath-seraphic-overture-bonus")).toMatchObject({ repeat: 10 });
    const fusion = findPersonalRotationScenario("aemeath", "fusion-burst")!;
    expect(fusion.specialEvents?.find((event) => event.id === "aemeath-fusion-seraphic-encore")?.sequenceOverrides).toContainEqual({ minimumSequence: 6, payload: { multiplierIncreasePercent: 700 } });
    expect(fusion.specialEvents?.find((event) => event.id === "aemeath-fusion-seraphic-overture")?.sequenceOverrides).toContainEqual({ minimumSequence: 6, payload: { multiplierIncreasePercent: 610 } });
  });

  it("keeps S0 Between the Stars mode-specific own-contributor values exact", () => {
    expect(rule("aemeath-between-stars-personal-runtime", "between-stars-tune-own-contributor")).toMatchObject({ modifiers: [{ kind: "crit-damage-bonus", value: 20 }] });
    expect(rule("aemeath-between-stars-personal-runtime", "between-stars-fusion-own-contributor")).toMatchObject({ modifiers: [{ kind: "crit-damage-bonus", value: 30 }] });
  });
});
