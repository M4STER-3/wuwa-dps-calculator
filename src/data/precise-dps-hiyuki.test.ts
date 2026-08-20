import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { calculateNegativeStatusDamage, glacioChafeMotionValue } from "@/domain/negative-status-damage";
import { HIYUKI, HIYUKI_GLACIO_BITE_STATUS } from "./precise-dps-hiyuki";
import { hiyukiLoopScenario, hiyukiOpenerScenario } from "./precise-dps-hiyuki-scenarios";
import { preciseDpsFutureScenarios, preciseDpsScenarioInventory } from "./precise-dps-future";
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
    id: `hiyuki-s${sequence}`,
    resonatorId: "hiyuki",
    sourcePresetId: "precise-hiyuki-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function run(
  scenario: typeof hiyukiOpenerScenario | typeof hiyukiLoopScenario,
  sequence: Sequence = 0,
) {
  const resonator = findPreciseDpsResonator("hiyuki")!;
  const weapon = findPreciseDpsWeapon("hiyuki")!;
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build: build(sequence, weapon.id),
    stats,
    target: { level: 90, elementalResistance: { glacio: 0.1 }, physicalResistance: 0.1 },
    weapon,
    actions: resonator.combat!.actions,
    baseStatBasis: {
      attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
  }).simulation;
}

const actionIds = (
  scenario: typeof hiyukiOpenerScenario | typeof hiyukiLoopScenario,
) => scenario.rotation.steps.flatMap((step) =>
  "actionId" in step ? Array(step.repeat ?? 1).fill(step.actionId) : [],
);

describe("Hiyuki precise DPS runtime", () => {
  it("publishes both Hiyuki scenarios as executable overrides", () => {
    expect(
      preciseDpsFutureScenarios
        .filter((scenario) => scenario.resonatorId === "hiyuki")
        .map((scenario) => scenario.id),
    ).toEqual(["hiyuki-opener", "hiyuki-loop"]);
    expect(
      preciseDpsScenarioInventory
        .filter((entry) => entry.resonatorId === "hiyuki")
        .map((entry) => [entry.scenarioId, entry.executable]),
    ).toEqual([
      ["hiyuki-opener", true],
      ["hiyuki-loop", true],
    ]);
  });

  it("pins the reviewed standard personal recipe and the precise 11.67s total", () => {
    expect(actionIds(hiyukiOpenerScenario)).toEqual([
      HIYUKI.intro,
      HIYUKI.presentBasic3,
      HIYUKI.frostSplinter,
      HIYUKI.inwardVision,
      HIYUKI.foreclaimedBasic1,
      HIYUKI.foreclaimedBasic2,
      HIYUKI.foreclaimedBasic3,
      HIYUKI.jadeCleave,
      HIYUKI.petalfall,
      HIYUKI.foreclaimedBasic1,
      HIYUKI.foreclaimedBasic2,
      HIYUKI.foreclaimedBasic3,
      HIYUKI.iai,
      HIYUKI.iai,
      HIYUKI.iai,
      HIYUKI.bitterfrost,
      HIYUKI.bladeLiberation,
      HIYUKI.presentSkill,
    ]);
    expect(hiyukiOpenerScenario.targetDuration?.seconds).toBe(11.67);
    expect(hiyukiLoopScenario.targetDuration?.seconds).toBe(11.67);
    expect(run(hiyukiOpenerScenario).rotationDurationSeconds).toBeCloseTo(11.67, 10);
    expect(run(hiyukiLoopScenario).rotationDurationSeconds).toBeCloseTo(11.67, 10);
  });

  it("uses the kit-owned Liberation classification instead of generated name heuristics", () => {
    const resonator = findPreciseDpsResonator("hiyuki")!;
    const action = (id: string) => resonator.combat!.actions.find((candidate) => candidate.id === id)!;
    for (const id of [
      HIYUKI.intro,
      HIYUKI.frostSplinter,
      HIYUKI.foreclaimedBasic1,
      HIYUKI.foreclaimedBasic2,
      HIYUKI.foreclaimedBasic3,
      HIYUKI.bitterfrost,
      HIYUKI.inwardVision,
      HIYUKI.bladeLiberation,
      HIYUKI.iai,
    ]) {
      expect(action(id).damageType).toBe("resonanceLiberation");
    }
    expect(action(HIYUKI.jadeCleave).talent).toBe("resonanceSkill");
    expect(action(HIYUKI.petalfall).talent).toBe("resonanceSkill");
  });

  it("keeps exact resources and Frostburn rank data structured", () => {
    const resonator = findPreciseDpsResonator("hiyuki")!;
    expect(Object.fromEntries(resonator.combat!.resources.map((entry) => [entry.id, entry.cap]))).toEqual({
      dedication: 300,
      frostheart: 300,
      "frostharden-iai": 3,
      "whiteout-bitterfrost": 3,
      "snowforged-blade": 3,
    });
    const weapon = findPreciseDpsWeapon("hiyuki")!;
    expect(weapon.level90Stats?.baseAttack).toBe(587.5);
    expect(weapon.level90Stats?.displayBaseAttack).toBe(588);
    expect(weapon.level90Stats?.critRate).toBe(24.3);
    expect(weapon.effects?.some((effect) => effect.id === "precise-frostburn-glacio-window")).toBe(true);
    expect(weapon.effects?.some((effect) => effect.id === "precise-frostburn-chafe-window")).toBe(true);
  });

  it("executes the opener resource route, Bite status and Snowforged finisher without inventing Frostheart per-hit gains", () => {
    const simulation = run(hiyukiOpenerScenario, 0);
    expect(simulation.personalDamage.expected).toBeGreaterThan(0);
    expect(simulation.breakdown.status.expected).toBeGreaterThan(0);
    expect(simulation.perAction[HIYUKI.glacioBiteStatusAction]?.expected ?? 0).toBeGreaterThan(0);
    expect(simulation.finalState.actors.hiyuki?.form).toBe("Present Self");
    expect(simulation.finalState.actors.hiyuki?.resources.dedication?.current).toBe(0);
    expect(simulation.finalState.actors.hiyuki?.resources.frostheart?.current).toBe(0);
    expect(simulation.finalState.actors.hiyuki?.resources["frostharden-iai"]?.current).toBe(0);
    expect(simulation.finalState.actors.hiyuki?.resources["whiteout-bitterfrost"]?.current).toBe(0);
    expect(simulation.finalState.actors.hiyuki?.resources["snowforged-blade"]?.current).toBe(0);
    expect(simulation.finalState.targets["training-target"]?.statuses[HIYUKI_GLACIO_BITE_STATUS]?.stacks).toBe(7);
    expect(
      simulation.stateTransitions.some(
        (entry) => entry.kind === "resource-set-max" && entry.detail === "frostheart",
      ),
    ).toBe(true);
  });

  it("keeps opener and banked-loop Snowforged Blade damage distinct at S0", () => {
    const opener = run(hiyukiOpenerScenario, 0);
    const loop = run(hiyukiLoopScenario, 0);
    expect(loop.perAction[HIYUKI.bladeLiberation]?.expected ?? 0).toBeGreaterThan(
      opener.perAction[HIYUKI.bladeLiberation]?.expected ?? 0,
    );
    expect(
      loop.audits
        .find((entry) => entry.actionId === HIYUKI.bladeLiberation)
        ?.motionValueContributions.some((entry) => entry.value > 1500),
    ).toBe(true);
  });

  it("counts S4's nearby-team damage buff on Hiyuki herself while keeping Outro off her Personal DPS", () => {
    const s3 = run(hiyukiOpenerScenario, 3);
    const s4 = run(hiyukiOpenerScenario, 4);
    expect(s4.personalDamage.expected).toBeGreaterThan(s3.personalDamage.expected);
    const resonator = findPreciseDpsResonator("hiyuki")!;
    const s4Effect = resonator.combat!.effects.find((effect) => effect.id === "precise-hiyuki-s4-team-damage")?.structuredEffect;
    const outro = resonator.combat!.effects.find((effect) => effect.id === "precise-hiyuki-outro-other-glacio")?.structuredEffect;
    expect(s4Effect?.target).toBe("team");
    expect(s4Effect?.teamContextRequired).not.toBe(true);
    expect(outro?.target).toBe("other-team-members");
    expect(outro?.teamContextRequired).toBe(true);
  });

  it("models S3 Fine Snow as additional Negative Status damage and S6 as personal crit mechanics", () => {
    const s2 = run(hiyukiOpenerScenario, 2);
    const s3 = run(hiyukiOpenerScenario, 3);
    const s6 = run(hiyukiOpenerScenario, 6);
    expect(s3.perAction[HIYUKI.fineSnowBiteAction]?.expected ?? 0).toBeGreaterThan(0);
    expect(s3.breakdown.status.expected).toBeGreaterThan(s2.breakdown.status.expected);
    expect(s6.personalDamage.expected).toBeGreaterThan(s3.personalDamage.expected);
  });

  it("uses the verified generic Glacio Chafe table and Fine Snow 102% override", () => {
    expect(glacioChafeMotionValue(10)).toBe(20377);
    const target = { level: 90, elementalResistance: { glacio: 0.1 }, physicalResistance: 0.1 } as const;
    const chafe = calculateNegativeStatusDamage({
      kind: "glacioChafe",
      attackerLevel: 90,
      target,
      stacks: 10,
    });
    const fineSnow = calculateNegativeStatusDamage({
      kind: "glacioChafe",
      attackerLevel: 90,
      target,
      stacks: 1,
      motionValueBasisPointsOverride: 10200,
    });
    expect(chafe.levelConstant).toBe(3674);
    expect(chafe.motionValueBasisPoints).toBe(20377);
    expect(fineSnow.motionValueBasisPoints).toBe(10200);
    expect(chafe.effectiveCritRate).toBe(0);
    expect(fineSnow.effectiveCritRate).toBe(0);
  });
});
