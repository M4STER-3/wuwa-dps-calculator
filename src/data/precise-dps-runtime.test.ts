import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import {
  preciseDpsFutureResonators,
  preciseDpsFutureScenarios,
  preciseDpsFutureWeapons,
} from "./precise-dps-future";

const zeroElements: FinalStats["elementalDamageBonus"] = {
  aero: 0,
  glacio: 0,
  electro: 0,
  fusion: 0,
  havoc: 0,
  spectro: 0,
};
const zeroDamageTypes: FinalStats["damageTypeBonus"] = {
  basicAttack: 0,
  heavyAttack: 0,
  resonanceSkill: 0,
  resonanceLiberation: 0,
  introSkill: 0,
  echoSkill: 0,
};

const stats = (energyRegen = 100): FinalStats => ({
  hp: 20000,
  attack: 2000,
  defense: 3000,
  critRate: 5,
  critDamage: 150,
  energyRegen,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { ...zeroElements },
  damageTypeBonus: { ...zeroDamageTypes },
});

const build = (
  resonatorId: string,
  weaponId: string,
  sequence: Sequence,
  finalStats: FinalStats,
): UserBuild => ({
  id: `runtime-${resonatorId}-s${sequence}`,
  resonatorId,
  sourcePresetId: "precise-runtime-test",
  characterLevel: 90,
  sequence,
  skillLevels: {
    basicAttack: 10,
    resonanceSkill: 10,
    forteCircuit: 10,
    resonanceLiberation: 10,
    introSkill: 10,
  },
  weapon: { weaponId, level: 90, rank: 1 },
  finalStats,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
});

const run = (scenarioId: string, sequence: Sequence = 0, energyRegen = 100) => {
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) throw new Error(`Missing scenario ${scenarioId}.`);
  const resonator = preciseDpsFutureResonators.find((entry) => entry.id === scenario.resonatorId);
  const weapon = preciseDpsFutureWeapons.find((entry) => entry.type === resonator?.weaponType && entry.name === (
    scenario.resonatorId === "lynae" ? "Spectrum Blaster" : scenario.resonatorId === "mornye" ? "Starfield Calibrator" : ""
  ));
  if (!resonator || !weapon || !resonator.combat) throw new Error(`Missing runtime loadout for ${scenarioId}.`);
  const finalStats = stats(energyRegen);
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build: build(resonator.id, weapon.id, sequence, finalStats),
    stats: finalStats,
    target: {
      level: 90,
      elementalResistance: {},
      physicalResistance: 0,
    },
    weapon,
    actions: resonator.combat.actions,
    baseStatBasis: {
      attack: resonator.baseStats?.[0]?.attack,
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
      provenance: `${resonator.name} Lv90 base stats`,
    },
  });
};

describe("precise future DPS runtime mechanics", () => {
  it("executes Lynae Overflow -> Lumiflow -> True Color and exits Parade at S0", () => {
    const result = run("lynae-tune-rupture").simulation;
    const details = result.stateTransitions.map((transition) => transition.detail);
    expect(details).toContain("overflow:0->100");
    expect(details).toContain("overflow:100->120");
    expect(details).toContain("overflow:120->0");
    expect(details).toContain("lumiflow:0->120");
    expect(details).toContain("lumiflow:120->80");
    expect(details).toContain("lumiflow:80->40");
    expect(details).toContain("lumiflow:40->0");
    expect(details).toContain("true-color:0->1");
    expect(details).toContain("true-color:1->2");
    expect(details).toContain("true-color:2->3");
    expect(details).toContain("true-color:3->0");
    expect(result.finalState.actors.lynae?.form).toBe("Optical Sampling Stage");
    expect(result.personalDamage.expected).toBeGreaterThan(0);
    expect(result.partial).toBe(true);
  });

  it("applies Lynae sequence damage rules cumulatively without hiding team-context partials", () => {
    const s0 = run("lynae-tune-rupture", 0).simulation.personalDamage.expected;
    const s1 = run("lynae-tune-rupture", 1).simulation.personalDamage.expected;
    const s2 = run("lynae-tune-rupture", 2).simulation.personalDamage.expected;
    const s3 = run("lynae-tune-rupture", 3).simulation.personalDamage.expected;
    const s5 = run("lynae-tune-rupture", 5).simulation.personalDamage.expected;
    expect(s1).toBeGreaterThan(s0);
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);
    expect(s5).toBeGreaterThan(s3);
  });

  it("generates Mornye Syntony Field damage when entering Wide Field Observation Mode", () => {
    const result = run("mornye-loop", 0, 260).simulation;
    const syntonyActionId = "precise-mornye-attr-1209028";
    expect(result.perAction[syntonyActionId]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.finalState.actors.mornye?.form).toBe("Baseline Mode");
    expect(result.personalDamage.expected).toBeGreaterThan(0);
  });

  it("calculates Critical Protocol Crit Rate and Crit DMG from excess Energy Regen", () => {
    const baseline = run("mornye-loop", 0, 100).simulation;
    const highEr = run("mornye-loop", 0, 260).simulation;
    const liberationId = "precise-mornye-attr-1209021";
    const baselineAudit = baseline.audits.find((audit) => audit.actionId === liberationId);
    const highErAudit = highEr.audits.find((audit) => audit.actionId === liberationId);
    expect(baselineAudit?.effectiveStats.critRate).toBeCloseTo(5);
    expect(baselineAudit?.effectiveStats.critDamage).toBeCloseTo(150);
    expect(highErAudit?.effectiveStats.critRate).toBeCloseTo(85);
    expect(highErAudit?.effectiveStats.critDamage).toBeCloseTo(310);
    expect(highEr.perAction[liberationId]?.expected ?? 0).toBeGreaterThan(baseline.perAction[liberationId]?.expected ?? 0);
  });

  it("applies Mornye S5 and S6 Liberation multiplier increases cumulatively", () => {
    const s0 = run("mornye-loop", 0, 260).simulation.perAction["precise-mornye-attr-1209021"]?.expected ?? 0;
    const s5 = run("mornye-loop", 5, 260).simulation.perAction["precise-mornye-attr-1209021"]?.expected ?? 0;
    const s6 = run("mornye-loop", 6, 260).simulation.perAction["precise-mornye-attr-1209021"]?.expected ?? 0;
    expect(s5).toBeGreaterThan(s0);
    expect(s6).toBeGreaterThan(s5);
  });
});
