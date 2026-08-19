import { describe, expect, it } from "vitest";
import {
  preciseDpsFutureResonators,
  preciseDpsFutureScenarios,
  preciseDpsFutureWeapons,
  preciseDpsScenarioInventory,
} from "./precise-dps-future";

describe("precise future DPS projection", () => {
  it("keeps all ten requested characters unique and partial until mechanics are complete", () => {
    expect(preciseDpsFutureResonators).toHaveLength(10);
    expect(new Set(preciseDpsFutureResonators.map((entry) => entry.id)).size).toBe(10);
    expect(preciseDpsFutureWeapons).toHaveLength(10);
    expect(preciseDpsScenarioInventory.every((scenario) => scenario.mechanicsStatus === "partial")).toBe(true);
  });

  it("models Lynae as two explicit resonance-mode scenarios", () => {
    const lynae = preciseDpsFutureResonators.find((entry) => entry.id === "lynae");
    expect(lynae?.combat?.modes).toEqual(["tune-rupture", "tune-strain"]);
    expect(lynae?.combat?.forms).toEqual(["Optical Sampling Stage", "Kaleidoscopic Parade"]);
    expect(lynae?.combat?.resources.map(({ id, cap }) => [id, cap])).toEqual([
      ["overflow", 120],
      ["lumiflow", 120],
      ["true-color", 3],
    ]);
    const scenarios = preciseDpsFutureScenarios.filter((scenario) => scenario.resonatorId === "lynae");
    expect(scenarios.map((scenario) => scenario.resonanceMode).sort()).toEqual(["tune-rupture", "tune-strain"]);
    expect(scenarios).toHaveLength(2);
    expect(scenarios.every((scenario) => scenario.rotation.steps.length === 9)).toBe(true);
  });

  it("keeps Mornye opener, loop and conditional Forte-skip paths separate", () => {
    const mornye = preciseDpsFutureResonators.find((entry) => entry.id === "mornye");
    expect(mornye?.combat?.forms).toEqual(["Baseline Mode", "Wide Field Observation Mode"]);
    expect(mornye?.combat?.resources.map(({ id, cap }) => [id, cap])).toEqual([
      ["rest-mass-energy", 100],
      ["relative-momentum", 100],
    ]);
    const inventory = preciseDpsScenarioInventory.filter((scenario) => scenario.resonatorId === "mornye");
    expect(inventory.map((scenario) => scenario.variant)).toEqual(["opener", "loop", "loop-forte-skip"]);
    expect(inventory.find((scenario) => scenario.variant === "loop-forte-skip")?.eligibility).toContain("S0 only");
    expect(preciseDpsFutureScenarios.filter((scenario) => scenario.resonatorId === "mornye")).toHaveLength(3);
  });
});
