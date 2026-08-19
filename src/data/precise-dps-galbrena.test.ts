import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { GALBRENA } from "./precise-dps-galbrena";
import { galbrenaPreciseScenario } from "./precise-dps-galbrena-scenario";
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
    id: `galbrena-s${sequence}`,
    resonatorId: "galbrena",
    sourcePresetId: "precise-galbrena-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function run(sequence: Sequence = 0) {
  const resonator = findPreciseDpsResonator("galbrena")!;
  const weapon = findPreciseDpsWeapon("galbrena")!;
  return {
    resonator,
    weapon,
    simulation: runTheoreticalPersonalRotation({
      scenario: galbrenaPreciseScenario,
      resonator,
      build: build(sequence, weapon.id),
      stats,
      target: { level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1 },
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

describe("Galbrena precise DPS runtime", () => {
  it("uses exact GameDatabase identities with kit-owned Heavy/Echo classifications", () => {
    const resonator = findPreciseDpsResonator("galbrena")!;
    const action = (id: string) => resonator.combat!.actions.find((candidate) => candidate.id === id)!;
    for (const id of [GALBRENA.basic1, GALBRENA.basic2, GALBRENA.basic3, GALBRENA.encroach, GALBRENA.ascent, GALBRENA.seraphic1, GALBRENA.seraphic2, GALBRENA.seraphic3, GALBRENA.ravage]) {
      expect(action(id).damageType).toBe("heavyAttack");
    }
    for (const id of [GALBRENA.basic4, GALBRENA.liberation, GALBRENA.seraphic4, GALBRENA.seraphic5, GALBRENA.flamewing3]) {
      expect(action(id).damageType).toBe("echoSkill");
    }
    expect(action(GALBRENA.outro).multipliers).toEqual([
      { percent: 79.5, hits: 3 },
      { percent: 556.5, hits: 1 },
    ]);
  });

  it("owns exact resource caps and the reviewed 12.2s total duration", () => {
    const { resonator, simulation } = run(0);
    expect(resonator.combat!.resources.map(({ id, cap }) => [id, cap])).toEqual([
      ["afterflame", 40],
      ["sinflame", 100],
      ["purging-flame", 100],
    ]);
    expect(simulation.timeline.finalDurationSeconds).toBeCloseTo(12.2, 10);
  });

  it("uses the reference Echo event to reach 24 Afterflame before Ascent and exits Demon after depletion", () => {
    const { simulation } = run(0);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-gain" && entry.detail === "afterflame")).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-set-max" && entry.detail === "sinflame")).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-set-max" && entry.detail === "purging-flame")).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-consume-all" && entry.detail === "purging-flame")).toBe(true);
    expect(simulation.finalState.actors.galbrena?.form).toBe("Threshold State");
    expect(simulation.finalState.actors.galbrena?.resources.afterflame?.current).toBe(0);
  });

  it("applies Burning Drive as +20% ATK at S0 and +90% total at S2", () => {
    const s0 = run(0).simulation;
    const s2 = run(2).simulation;
    const s0Audit = s0.audits.find((entry) => entry.actionId === GALBRENA.ascent)!;
    const s2Audit = s2.audits.find((entry) => entry.actionId === GALBRENA.ascent)!;
    expect(s0Audit.effectiveStats.attack).toBeGreaterThan(stats.attack);
    expect(s2Audit.effectiveStats.attack).toBeGreaterThan(s0Audit.effectiveStats.attack);
    const baseAttack = s0Audit.effectiveStats.attack / 1.2;
    expect(s2Audit.effectiveStats.attack).toBeCloseTo(baseAttack * 1.9, 6);
  });

  it("applies S3/S5/S6 motion-value rules and S6 Eternal form path", () => {
    const s3 = run(3).simulation;
    const s5 = run(5).simulation;
    const s6 = run(6).simulation;
    expect(s3.audits.find((entry) => entry.actionId === GALBRENA.liberation)?.motionValueContributions.some((entry) => entry.value === 130)).toBe(true);
    expect(s5.audits.find((entry) => entry.actionId === GALBRENA.ascent)?.motionValueContributions.some((entry) => entry.value === 150)).toBe(true);
    expect(s6.audits.find((entry) => entry.actionId === GALBRENA.seraphic4)?.motionValueContributions.some((entry) => entry.value === 60)).toBe(true);
    expect(s6.stateTransitions.some((entry) => entry.kind === "form-change" && entry.detail === "Eternal Hypostasis")).toBe(true);
  });

  it("normalizes Lux & Umbra R1 dual-window DEF Ignore to 0.08", () => {
    const { weapon } = run(0);
    const both = weapon.effects?.find((effect) => effect.structuredEffect?.id === "precise-lux-umbra-both-windows")?.structuredEffect;
    const modifier = both?.rules.find((rule) => rule.id === "lux-umbra-defense-ignore")?.modifiers[0];
    expect(modifier?.kind).toBe("defense-ignore");
    if (modifier?.kind !== "defense-ignore" || modifier.valueExpression?.kind !== "rank") {
      throw new Error("Lux & Umbra DEF Ignore ratio expression missing.");
    }
    expect(modifier.valueExpression.values[1]).toBeCloseTo(0.08);
    expect(modifier.valueExpression.values[5]).toBeCloseTo(0.16);
  });

  it("produces personal damage for the complete reference action sequence", () => {
    const { simulation } = run(0);
    expect(simulation.personalDamage.expected).toBeGreaterThan(0);
    expect(simulation.perAction[GALBRENA.liberation]?.expected ?? 0).toBeGreaterThan(0);
    expect(simulation.perAction[GALBRENA.seraphic4]?.expected ?? 0).toBeGreaterThan(0);
    expect(simulation.perAction[GALBRENA.outro]?.expected ?? 0).toBeGreaterThan(0);
  });
});
