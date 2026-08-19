import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { SHOREKEEPER_MANUAL, SHOREKEEPER_NATIVE } from "./precise-dps-shorekeeper-core";

const stats: FinalStats = {
  hp: 40000,
  attack: 1200,
  defense: 1100,
  critRate: 25,
  critDamage: 180,
  energyRegen: 230,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function build(sequence: Sequence, weaponId: string): UserBuild {
  return {
    id: `shorekeeper-s${sequence}`,
    resonatorId: "shorekeeper",
    sourcePresetId: "precise-shorekeeper-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

function run(
  scenarioId: "shorekeeper-opener" | "shorekeeper-loop",
  sequence: Sequence = 0,
  withWeapon = true,
) {
  const resonator = findPreciseDpsResonator("shorekeeper")!;
  const weapon = findPreciseDpsWeapon("shorekeeper")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === scenarioId)!;
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build: build(sequence, weapon.id),
    stats,
    target: { level: 90, elementalResistance: { spectro: 0.1 }, physicalResistance: 0.1 },
    ...(withWeapon ? { weapon } : {}),
    actions: resonator.combat!.actions,
    baseStatBasis: {
      attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
  }).simulation;
}

function runtimeContext(result: ReturnType<typeof run>) {
  return JSON.stringify({
    diagnostics: result.diagnostics,
    stateDiagnostics: result.stateDiagnostics,
    hitEvents: result.eventLog
      .filter((entry) => entry.kind === "action-hit")
      .map((entry) => ({ id: entry.id, actionId: entry.actionId, timestamp: entry.timestamp })),
    resourceTransitions: result.stateTransitions.filter((entry) =>
      entry.kind.includes("resource"),
    ),
  });
}

describe("Shorekeeper precise DPS runtime", () => {
  it("pins native GameDatabase actions and adds zero-MV End Loop as an explicit timeline action", () => {
    const resonator = findPreciseDpsResonator("shorekeeper")!;
    for (const id of Object.values(SHOREKEEPER_NATIVE)) {
      expect(resonator.combat!.actions.some((action) => action.id === id)).toBe(true);
    }
    const endLoop = resonator.combat!.actions.find((action) => action.id === SHOREKEEPER_MANUAL.endLoop)!;
    expect(endLoop.multipliers).toEqual([]);
    expect(findPreciseDpsWeapon("shorekeeper")?.level90Stats?.energyRegen).toBe(77);
  });

  it("executes exact Empirical Data 1+1+2+1 and consumes all 5 on every Illation", () => {
    const result = run("shorekeeper-opener", 0);
    const context = runtimeContext(result);
    expect(result.finalState.actors.shorekeeper?.resources["empirical-data"]?.current, context).toBe(0);
    const empirical = result.stateTransitions.filter((entry) =>
      entry.kind.startsWith("action-resource-") && entry.detail.startsWith("empirical-data:"),
    );
    for (const transition of [
      "empirical-data:0->1",
      "empirical-data:1->2",
      "empirical-data:2->4",
      "empirical-data:4->5",
    ]) {
      expect(empirical.some((entry) => entry.detail === transition), context).toBe(true);
    }
    expect(empirical.filter((entry) => entry.detail === "empirical-data:5->0"), context).toHaveLength(2);
  });

  it("derives seven Flare Star Butterflies per BA1-4 → Illation cycle from exact hit cardinality", () => {
    const opener = run("shorekeeper-opener", 0);
    const loop = run("shorekeeper-loop", 0);
    const openerFlares = opener.audits.filter((entry) => entry.actionId === SHOREKEEPER_NATIVE.flareStarButterfly);
    const loopFlares = loop.audits.filter((entry) => entry.actionId === SHOREKEEPER_NATIVE.flareStarButterfly);
    expect(openerFlares, runtimeContext(opener)).toHaveLength(14);
    expect(loopFlares, runtimeContext(loop)).toHaveLength(7);
    expect(opener.finalState.actors.shorekeeper?.resources["collapsed-core"]?.current).toBe(0);
    expect(loop.finalState.actors.shorekeeper?.resources["collapsed-core"]?.current).toBe(0);
  });

  it("treats Discernment as guaranteed-Crit Resonance Liberation DMG", () => {
    const result = run("shorekeeper-loop", 0);
    const amounts = result.perAction[SHOREKEEPER_NATIVE.discernment]!;
    expect(amounts.expected).toBeCloseTo(amounts.crit, 8);
    expect(amounts.crit).toBeGreaterThan(amounts.nonCrit);
    const action = findPreciseDpsResonator("shorekeeper")!.combat!.actions.find(
      (candidate) => candidate.id === SHOREKEEPER_NATIVE.discernment,
    )!;
    expect(action.damageType).toBe("resonanceLiberation");
  });

  it("applies S1 Stellarealm extension, S4 healing bonus and S6 Discernment damage exactly", () => {
    const s0Opener = run("shorekeeper-opener", 0);
    const s1Opener = run("shorekeeper-opener", 1);
    expect(s0Opener.stateTransitions.some((entry) => entry.kind === "effect-extended" && entry.detail === "precise-shorekeeper-end-loop-personal")).toBe(false);
    expect(s1Opener.stateTransitions.some((entry) => entry.kind === "effect-extended" && entry.detail === "precise-shorekeeper-end-loop-personal")).toBe(true);

    const s3Loop = run("shorekeeper-loop", 3);
    const s4Loop = run("shorekeeper-loop", 4);
    const s3Skill = s3Loop.audits.find((entry) => entry.actionId === SHOREKEEPER_NATIVE.chaosTheory)!;
    const s4Skill = s4Loop.audits.find((entry) => entry.actionId === SHOREKEEPER_NATIVE.chaosTheory)!;
    expect(s4Skill.effectiveStats.healingBonus).toBeGreaterThan(s3Skill.effectiveStats.healingBonus);

    const s5 = run("shorekeeper-loop", 5);
    const s6 = run("shorekeeper-loop", 6);
    const s6Discernment = s6.audits.find((entry) => entry.actionId === SHOREKEEPER_NATIVE.discernment)!;
    expect(s6Discernment.motionValueContributions.some((entry) => entry.value === 42)).toBe(true);
    expect(s6.perAction[SHOREKEEPER_NATIVE.discernment]!.crit).toBeGreaterThan(
      s5.perAction[SHOREKEEPER_NATIVE.discernment]!.crit,
    );
  });

  it("keeps Team Cycle-owned Stellarealm evolution and Stellar Symphony team recipients explicitly partial", () => {
    const result = run("shorekeeper-loop", 6, true);
    expect(result.partial).toBe(true);
    expect(result.diagnostics.some((entry) =>
      entry.code === "team-context-required" && entry.message.includes("shorekeeper-team-cycle"),
    )).toBe(true);
    expect(result.diagnostics.some((entry) =>
      entry.code === "team-context-required" && entry.message.includes("stellar-symphony"),
    )).toBe(true);
  });
});
