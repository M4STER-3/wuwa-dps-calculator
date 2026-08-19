import { describe, expect, it } from "vitest";
import { aemeathPreset } from "@/data/aemeath";
import { createBuildFromPreset } from "./character-box";
import { calculateActionDamage } from "./damage-engine";
import { calculateActionLab, compareObservedDamage, DEFAULT_LAB_TARGET, isStandardDamage, resolvePersonalLoadout, simulateRotationLab } from "./personal-dps-lab";

const build = createBuildFromPreset(aemeathPreset, { id: "aemeath-test", now: "2026-08-16T00:00:00Z" });

describe("Personal DPS Lab with real Aemeath data", () => {
  it("resolves exact equipment and Lv90 base-stat basis without text lookup", () => {
    const loadout = resolvePersonalLoadout(build);
    expect(loadout.weapon?.id).toBe("everbright-polestar");
    expect(loadout.baseStatBasis).toEqual({ attack: 1012.5, hp: 11025, defense: 1148.87 });
    expect(loadout.diagnostics).toEqual([]);
  });

  it("matches the direct Damage Engine result", () => {
    const loadout = resolvePersonalLoadout(build);
    const result = calculateActionLab({ loadout, actionId: "aemeath-basic-1", stats: build.finalStats, target: DEFAULT_LAB_TARGET });
    expect(result?.damage).toEqual(calculateActionDamage({ action: loadout.actions[0], finalStats: build.finalStats, attackerLevel: 90, scalingAttribute: "attack", element: "fusion", target: DEFAULT_LAB_TARGET }));
  });

  it("does not runtime-count permanent equipment and applies conditional overrides only manually", () => {
    const loadout = resolvePersonalLoadout(build);
    const baseline = calculateActionLab({ loadout, actionId: "overdrive", stats: build.finalStats, target: DEFAULT_LAB_TARGET })!;
    const everbright = calculateActionLab({ loadout, actionId: "overdrive", stats: build.finalStats, target: DEFAULT_LAB_TARGET, manualEffectIds: ["everbright-r1-base", "sigillum-main-aemeath", "trailblazing-2pc", "everbright-r1-liberation"] })!;
    expect(isStandardDamage(baseline.damage) && isStandardDamage(everbright.damage)).toBe(true);
    if (isStandardDamage(baseline.damage) && isStandardDamage(everbright.damage)) {
      expect(everbright.damage.allDamageBonusPercent).toBe(0);
      expect(everbright.damage.defenseIgnore).toBeCloseTo(0.32);
      expect(everbright.damage.resistanceIgnore).toBeCloseTo(0.1);
      expect(everbright.damage.total.expected).toBeGreaterThan(baseline.damage.total.expected);
    }
  });

  it("treats the theoretical reference rotation as complete and observable", () => {
    const loadout = resolvePersonalLoadout(build);
    const result = simulateRotationLab(loadout, build.finalStats, DEFAULT_LAB_TARGET, "tune-rupture")!;
    expect(result.partial).toBe(false);
    expect(result.rotationDurationSeconds).toBeCloseTo(11.69);
    expect(result.diagnostics.some((item) => item.code === "hit-timing-required")).toBe(false);
  });

  it("compares observed damage without changing combat results", () => {
    expect(compareObservedDamage(12345, 12348)).toEqual({ calculated: 12345, observed: 12348, absoluteDelta: -3, percentageDelta: expect.closeTo(-0.024295, 5) });
  });
});
