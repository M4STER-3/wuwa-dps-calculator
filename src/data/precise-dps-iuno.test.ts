import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { IUNO } from "./precise-dps-iuno";
import { iunoHybridScenario, iunoMainDpsScenario } from "./precise-dps-iuno-scenarios";
import { preciseDpsFutureResonators, preciseDpsFutureScenarios, preciseDpsScenarioInventory } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1200,
  critRate: 50,
  critDamage: 200,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function build(sequence: Sequence, weaponId: string): UserBuild {
  return {
    id: `iuno-s${sequence}`,
    resonatorId: "iuno",
    sourcePresetId: "precise-iuno-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function run(scenario: typeof iunoMainDpsScenario | typeof iunoHybridScenario, sequence: Sequence = 0) {
  const resonator = findPreciseDpsResonator("iuno")!;
  const weapon = findPreciseDpsWeapon("iuno")!;
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build: build(sequence, weapon.id),
    stats,
    target: { level: 90, elementalResistance: { aero: 0.1 }, physicalResistance: 0.1 },
    weapon,
    actions: resonator.combat!.actions,
    baseStatBasis: {
      attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
  }).simulation;
}

const stepIds = (scenario: typeof iunoMainDpsScenario | typeof iunoHybridScenario) =>
  scenario.rotation.steps.flatMap((step) => "actionId" in step ? Array(step.repeat ?? 1).fill(step.actionId) : []);

describe("Iuno precise DPS runtime", () => {
  it("publishes both Iuno modes as executable precise scenarios", () => {
    expect(preciseDpsFutureScenarios.filter((scenario) => scenario.resonatorId === "iuno").map((scenario) => scenario.id)).toEqual([
      "iuno-main-dps",
      "iuno-hybrid",
    ]);
    expect(preciseDpsScenarioInventory.filter((entry) => entry.resonatorId === "iuno").map((entry) => [entry.scenarioId, entry.executable])).toEqual([
      ["iuno-main-dps", true],
      ["iuno-hybrid", true],
    ]);
  });

  it("pins the reviewed Main-DPS and Hybrid action recipes", () => {
    expect(stepIds(iunoMainDpsScenario)).toEqual([
      IUNO.intro,
      IUNO.closingRefrain,
      IUNO.fluxMoonbow,
      IUNO.enhancedMoonbow1,
      IUNO.enhancedMoonbow2,
      IUNO.enhancedMoonbow3,
      IUNO.enhancedArc,
      IUNO.liberation,
      IUNO.enhancedMoonbow1,
      IUNO.enhancedMoonbow2,
      IUNO.enhancedMoonbow3,
      IUNO.enhancedArc,
      IUNO.moonbow1,
      IUNO.moonbow2,
      IUNO.moonbow3,
      IUNO.outro,
    ]);
    expect(stepIds(iunoHybridScenario)).toEqual([
      IUNO.intro,
      IUNO.liberation,
      IUNO.fluxMoonbow,
      IUNO.enhancedMoonbow1,
      IUNO.enhancedMoonbow2,
      IUNO.enhancedMoonbow3,
      IUNO.enhancedArc,
      IUNO.enhancedArc,
      IUNO.absoluteFullness,
      IUNO.outro,
    ]);
  });

  it("calibrates only Main DPS to 8.43s and never leaks that duration into Hybrid", () => {
    const projected = preciseDpsFutureResonators.find((entry) => entry.id === "iuno")!;
    expect(projected.combat?.rotations).toEqual([]);
    expect(iunoMainDpsScenario.targetDuration?.seconds).toBe(8.43);
    expect(iunoHybridScenario.targetDuration).toBeUndefined();
    expect(run(iunoMainDpsScenario, 0).rotationDurationSeconds).toBeCloseTo(8.43, 10);
    expect(run(iunoHybridScenario, 0).rotationDurationSeconds).not.toBeCloseTo(8.43, 4);
  });

  it("uses kit-owned Resonance Liberation classifications and keeps personal Outro damage", () => {
    const resonator = findPreciseDpsResonator("iuno")!;
    const action = (id: string) => resonator.combat!.actions.find((candidate) => candidate.id === id)!;
    for (const id of [
      IUNO.fluxMoonbow,
      IUNO.fluxMoonring,
      IUNO.moonbow1,
      IUNO.moonbow2,
      IUNO.moonbow3,
      IUNO.enhancedMoonbow1,
      IUNO.enhancedMoonbow2,
      IUNO.enhancedMoonbow3,
      IUNO.enhancedArc,
      IUNO.absoluteFullness,
    ]) {
      expect(action(id).damageType).toBe("resonanceLiberation");
    }
    expect(action(IUNO.outro).damageType).toBe("outroSkill");
    expect(action(IUNO.outro).multipliers).toEqual([{ percent: 100, hits: 1 }]);
  });

  it("keeps outgoing Outro and Full Moon Domain effects out of Iuno self-buffs", () => {
    const resonator = findPreciseDpsResonator("iuno")!;
    const outro = resonator.combat!.effects.find((effect) => effect.id === "precise-iuno-outro-incoming-heavy")?.structuredEffect;
    const domain = resonator.combat!.effects.find((effect) => effect.id === "precise-iuno-full-moon-domain-team")?.structuredEffect;
    expect(outro?.target).toBe("incoming-resonator");
    expect(outro?.teamContextRequired).toBe(true);
    expect(domain?.target).toBe("team");
    expect(domain?.teamContextRequired).toBe(true);
  });

  it("gates Absolute Fullness S6 refill/form transition with universal Sequence runtime states", () => {
    const s0 = run(iunoHybridScenario, 0);
    const s6 = run(iunoHybridScenario, 6);
    expect(s0.finalState.actors.iuno?.form).toBe("Baseline");
    expect(s0.finalState.actors.iuno?.resources.sentience?.current).toBe(0);
    expect(s6.finalState.actors.iuno?.form).toBe("Lunar Cycle - New Moon");
    expect(s6.finalState.actors.iuno?.resources.sentience?.current).toBe(100);
    expect(s6.audits.find((entry) => entry.actionId === IUNO.absoluteFullness)?.motionValueContributions.some((entry) => entry.value === 1600)).toBe(true);
  });

  it("produces personal damage in both modes, including Iuno's own Outro hit", () => {
    for (const scenario of [iunoMainDpsScenario, iunoHybridScenario]) {
      const simulation = run(scenario, 0);
      expect(simulation.personalDamage.expected).toBeGreaterThan(0);
      expect(simulation.perAction[IUNO.outro]?.expected ?? 0).toBeGreaterThan(0);
    }
  });
});
