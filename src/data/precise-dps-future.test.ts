import { describe, expect, it } from "vitest";
import type { CombatAction } from "@/domain/models";
import {
  preciseDpsFutureResonators,
  preciseDpsFutureScenarios,
  preciseDpsFutureWeapons,
  preciseDpsScenarioInventory,
} from "./precise-dps-future";

type ProjectedAction = CombatAction & { readonly sourceAttributeId?: string };

const actionByAttribute = (resonatorId: string, sourceAttributeId: string): ProjectedAction => {
  const resonator = preciseDpsFutureResonators.find((entry) => entry.id === resonatorId);
  const action = (resonator?.combat?.actions as readonly ProjectedAction[] | undefined)?.find(
    (candidate) => candidate.sourceAttributeId === sourceAttributeId,
  );
  if (!action) throw new Error(`Missing ${resonatorId} action ${sourceAttributeId}.`);
  return action;
};

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
    expect(scenarios.every((scenario) => scenario.extraEffects?.some((effect) => effect.id === "precise-lynae-photochromic-flux"))).toBe(true);
    expect(scenarios.every((scenario) => scenario.extraEffects?.some((effect) => effect.id === "precise-lynae-sequences"))).toBe(true);
  });

  it("executes Lynae standard Forte resource transactions from exact reviewed quantities", () => {
    expect(actionByAttribute("lynae", "1509029").resourceOperations).toEqual([
      { resourceId: "overflow", operation: "gain", amount: 100, stage: "after-action" },
    ]);
    expect(actionByAttribute("lynae", "1509006").resourceOperations).toEqual([
      { resourceId: "overflow", operation: "gain", amount: 20, stage: "after-action" },
    ]);
    expect(actionByAttribute("lynae", "1509013").resourceOperations).toEqual([
      { resourceId: "overflow", operation: "consume", amount: 120, stage: "before-action" },
      { resourceId: "lumiflow", operation: "gain", amount: 120, stage: "after-action" },
    ]);
    for (const attributeId of ["1509020", "1509021", "1509022"]) {
      expect(actionByAttribute("lynae", attributeId).resourceOperations).toEqual([
        { resourceId: "lumiflow", operation: "consume", amount: 40, stage: "before-action" },
        { resourceId: "true-color", operation: "gain", amount: 1, stage: "after-action" },
      ]);
    }
    expect(actionByAttribute("lynae", "1509009").resourceOperations).toEqual([
      { resourceId: "true-color", operation: "consume", amount: 3, stage: "before-action" },
    ]);
  });

  it("keeps Lynae team-context reactions explicit while executing personal buffs and sequence rules", () => {
    const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === "lynae-tune-rupture");
    const effectIds = new Set(scenario?.extraEffects?.map((effect) => effect.id));
    expect(effectIds.has("precise-lynae-adaptive-optics")).toBe(true);
    expect(effectIds.has("precise-lynae-prismatic-overblast-buff")).toBe(true);
    expect(effectIds.has("precise-lynae-visual-impact-buff")).toBe(true);
    expect(effectIds.has("precise-lynae-tune-strain-team-context")).toBe(true);
    const sequenceEffect = scenario?.extraEffects?.find((effect) => effect.id === "precise-lynae-sequences");
    expect(sequenceEffect?.rules.map((rule) => rule.requiredSequence)).toEqual([1, 2, 3, 5]);
    expect(scenario?.specialEvents?.some((event) => event.kind === "outro" && event.maximumSequence === 5)).toBe(true);
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

  it("models Mornye Critical Protocol ER scaling and exact S5/S6 motion-value rules", () => {
    const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === "mornye-loop");
    const critical = scenario?.extraEffects?.find((effect) => effect.id === "precise-mornye-critical-protocol");
    expect(critical?.rules.map((rule) => [rule.id, rule.requiredSequence ?? 0])).toEqual([
      ["mornye-critical-protocol-er-crit", 0],
      ["mornye-s5-critical-protocol", 5],
      ["mornye-s5-particle-jet", 5],
      ["mornye-s6-critical-protocol", 6],
    ]);
    expect(actionByAttribute("mornye", "1209028").damageType).toBe("resonanceLiberation");
    expect(actionByAttribute("mornye", "1209031").damageType).toBe("tuneRupture");
  });

  it("gates Mornye sequence-owned marker/resource events at scenario level", () => {
    const scenarios = preciseDpsFutureScenarios.filter((entry) => entry.resonatorId === "mornye");
    for (const scenario of scenarios) {
      expect(scenario.extraEffects?.some((effect) => effect.id === "precise-mornye-markers")).toBe(true);
      expect(scenario.extraEffects?.some((effect) => effect.id === "precise-mornye-interfered-damage-team-context")).toBe(true);
      expect(scenario.specialEvents?.some((event) => event.id === "mornye-s1-immediate-interfered" && event.minimumSequence === 1)).toBe(true);
      expect(scenario.specialEvents?.some((event) => event.id === "mornye-s3-relative-momentum" && event.minimumSequence === 3)).toBe(true);
    }
  });
});
