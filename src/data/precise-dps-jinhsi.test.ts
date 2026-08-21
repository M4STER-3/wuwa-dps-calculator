import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1259,
  critRate: 50,
  critDamage: 200,
  energyRegen: 125,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function build(sequence: Sequence, weaponId: string): UserBuild {
  return {
    id: `jinhsi-s${sequence}`,
    resonatorId: "jinhsi",
    sourcePresetId: "precise-jinhsi-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

function run(scenarioId: "jinhsi-opener" | "jinhsi-loop", sequence: Sequence = 0) {
  const resonator = findPreciseDpsResonator("jinhsi")!;
  const weapon = findPreciseDpsWeapon("jinhsi")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === scenarioId)!;
  return {
    resonator,
    weapon,
    simulation: runTheoreticalPersonalRotation({
      scenario,
      resonator,
      build: build(sequence, weapon.id),
      stats,
      target: { level: 90, elementalResistance: { spectro: 0.1 }, physicalResistance: 0.1 },
      weapon,
      actions: resonator.combat!.actions,
      baseStatBasis: {
        attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
        hp: resonator.baseStats?.[0]?.hp,
        defense: resonator.baseStats?.[0]?.defense,
      },
    }).simulation,
  };
}

const actionId = (sourceAttributeId: string) => `precise-jinhsi-attr-${sourceAttributeId}`;

describe("Jinhsi precise DPS runtime", () => {
  it("keeps GameDatabase action identity while classifying Incarnation and Illuminous damage as Resonance Skill DMG", () => {
    const resonator = findPreciseDpsResonator("jinhsi")!;
    for (const id of ["1304023", "1304024", "1304025", "1304026", "1304027", "1304030", "1304039"]) {
      expect(resonator.combat!.actions.find((action) => action.id === actionId(id))?.damageType).toBe("resonanceSkill");
    }
    expect(findPreciseDpsWeapon("jinhsi")?.level90Stats?.critRate).toBeCloseTo(24.3);
  });

  it("emits Stella Glamor from Solar Flare without adding a second rotation action", () => {
    const result = run("jinhsi-opener", 0).simulation;
    expect(result.perAction[actionId("1304030")]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.perAction[actionId("1304039")]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.finalState.actors.jinhsi?.form).toBe("Normal State");
  });

  it("uses an explicit 50-Incandescence loop precondition, scales Stella from the live resource, then consumes it", () => {
    const opener = run("jinhsi-opener", 0).simulation;
    const loop = run("jinhsi-loop", 0).simulation;
    expect(loop.stateTransitions.some((entry) => entry.kind === "resource-set-max" && entry.detail === "incandescence")).toBe(true);
    expect(loop.stateTransitions.some((entry) => entry.kind === "resource-consume-up-to" && entry.detail === "incandescence")).toBe(true);
    expect(loop.finalState.actors.jinhsi?.resources.incandescence?.current).toBe(0);
    expect(loop.perAction[actionId("1304039")]?.expected ?? 0).toBeGreaterThan(opener.perAction[actionId("1304039")]?.expected ?? 0);
  });

  it("models S2 opener refill and S1 Herald stacks without replacing them with averages", () => {
    const s0 = run("jinhsi-opener", 0).simulation;
    const s1 = run("jinhsi-opener", 1).simulation;
    const s2 = run("jinhsi-opener", 2).simulation;
    expect(s1.perAction[actionId("1304030")]?.expected ?? 0).toBeGreaterThan(s0.perAction[actionId("1304030")]?.expected ?? 0);
    expect(s2.stateTransitions.some((entry) => entry.kind === "resource-set-max" && entry.detail === "incandescence")).toBe(true);
    expect(s2.perAction[actionId("1304039")]?.expected ?? 0).toBeGreaterThan(s1.perAction[actionId("1304039")]?.expected ?? 0);
  });

  it("applies S3 Intro ATK, S5 Liberation multiplier and S6 Illuminous multiplier cumulatively", () => {
    const s0 = run("jinhsi-loop", 0).simulation;
    const s3 = run("jinhsi-loop", 3).simulation;
    const s5 = run("jinhsi-loop", 5).simulation;
    const s6 = run("jinhsi-loop", 6).simulation;

    const overflow = actionId("1304012");
    const purge = actionId("1304016");
    const stella = actionId("1304039");
    const s0OverflowAudit = s0.audits.find((entry) => entry.actionId === overflow)!;
    const s3OverflowAudit = s3.audits.find((entry) => entry.actionId === overflow)!;
    const s5PurgeAudit = s5.audits.find((entry) => entry.actionId === purge)!;
    const s6StellaAudit = s6.audits.find((entry) => entry.actionId === stella)!;

    expect(s3OverflowAudit.effectiveStats.attack).toBeGreaterThan(s0OverflowAudit.effectiveStats.attack);
    expect(s5PurgeAudit.motionValueContributions.some((entry) => entry.value === 120)).toBe(true);
    expect(s6StellaAudit.motionValueContributions.some((entry) => entry.value === 45)).toBe(true);
    expect(s6.perAction[stella]?.expected ?? 0).toBeGreaterThan(s5.perAction[stella]?.expected ?? 0);
  });

  it("activates both independent Ages of Harvest Skill-DMG windows in the loop", () => {
    const result = run("jinhsi-loop", 0).simulation;
    const activated = result.stateTransitions
      .filter((entry) => entry.kind === "effect-activated")
      .map((entry) => entry.detail);
    expect(activated).toContain("precise-ages-of-harvest-ageless-marking");
    expect(activated).toContain("precise-ages-of-harvest-ethereal-endowment");
  });

  it("remains explicitly partial while Incandescence generation and Unison handoff require Team Cycle", () => {
    const result = run("jinhsi-loop", 6).simulation;
    expect(result.partial).toBe(true);
    expect(result.diagnostics.some((entry) =>
      entry.code === "team-context-required" && entry.message.includes("jinhsi-team-cycle"),
    )).toBe(true);
  });
});
