import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1200,
  critRate: 50,
  critDamage: 200,
  energyRegen: 125,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function actionBy(resonator: NonNullable<ReturnType<typeof findPreciseDpsResonator>>, ...tokens: string[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const matches = resonator.combat!.actions.filter((action) => {
    const name = normalize(action.name);
    return tokens.every((token) => name.includes(normalize(token).trim()));
  });
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function run(sequence: Sequence, mode: "fusion-burst" | "tune-strain" = "fusion-burst") {
  const resonator = findPreciseDpsResonator("denia")!;
  const weapon = findPreciseDpsWeapon("denia")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === `denia-${mode}`)!;
  const build: UserBuild = {
    id: `denia-s${sequence}-${mode}`,
    resonatorId: "denia",
    sourcePresetId: "precise-denia-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId: weapon.id, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
  return {
    resonator,
    simulation: runTheoreticalPersonalRotation({
      scenario,
      resonator,
      build,
      stats,
      target: { level: 90, elementalResistance: { fusion: 0.1 }, physicalResistance: 0.1, tuneEnemyClass: "4C" },
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

describe("Denia precise DPS runtime", () => {
  it("keeps Dark Core cap at 3 before S3 and raises it to 5 from S3 onward", () => {
    const resonator = findPreciseDpsResonator("denia")!;
    const darkCore = resonator.combat!.resources.find((resource) => resource.id === "dark-core")!;
    expect(darkCore.cap).toBe(3);
    expect(darkCore.capBySequence).toEqual({ 3: 5 });
    expect(run(0).simulation.finalState.actors.denia.resources["dark-core"]?.max).toBe(3);
    expect(run(3).simulation.finalState.actors.denia.resources["dark-core"]?.max).toBe(5);
    expect(run(6).simulation.finalState.actors.denia.resources["dark-core"]?.max).toBe(5);
  });

  it("executes S0 combat-entry resources, Intro gain and Banish three-core scaling", () => {
    const { resonator, simulation } = run(0);
    const banish2 = actionBy(resonator, "Banish", "Breakdown Form", "Stage 2");
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-set" && entry.detail === "dark-core")).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "action-resource-gain" && entry.detail === "dark-core:2->3")).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-consume-all" && entry.detail === "dark-core")).toBe(true);
    const audit = simulation.audits.find((entry) => entry.actionId === banish2.id)!;
    expect(audit.effectiveMotionValue - audit.originalMotionValue).toBeCloseTo(450, 6);
    expect(simulation.finalState.actors.denia.form).toBe("Stagecraft Form");
  });

  it("executes S3 full-resource entry and the max-core Stagecraft 4 bonus", () => {
    const { resonator, simulation } = run(3);
    const stagecraft4 = actionBy(resonator, "Stagecraft Form", "Stage 4");
    const audit = simulation.audits.find((entry) => entry.actionId === stagecraft4.id)!;
    expect(audit.effectiveDamageType).toBe("resonanceLiberation");
    expect(audit.motionValueContributions.some((entry) => entry.value === 1200)).toBe(true);
    expect(simulation.stateTransitions.some((entry) => entry.kind === "resource-consume-all" && entry.detail === "dark-core")).toBe(true);
  });

  it("emits Denia's own mode applications so Forged Dwarf Star activates in both modes", () => {
    for (const mode of ["fusion-burst", "tune-strain"] as const) {
      const { resonator, simulation } = run(0, mode);
      const finalStagecraft = actionBy(resonator, "Final Act", "Stagecraft Form");
      const audit = simulation.audits.find((entry) => entry.actionId === finalStagecraft.id)!;
      expect(audit.activeEffectIds).toContain("precise-forged-dwarf-star-liberation-window");
      expect(
        simulation.stateTransitions.some(
          (entry) =>
            entry.kind === "effect-activated" &&
            entry.detail === "precise-forged-dwarf-star-team-atk-window",
        ),
      ).toBe(true);
    }
  });

  it("executes S1 entry Entropy and S2 mode-specific personal application windows", () => {
    const fusion = run(2, "fusion-burst");
    const fusionStagecraft4 = actionBy(fusion.resonator, "Stagecraft Form", "Stage 4");
    const fusionAudit = fusion.simulation.audits.find((entry) => entry.actionId === fusionStagecraft4.id)!;
    expect(fusionAudit.activeEffectIds).toContain("precise-denia-entropy-stagecraft");
    expect(fusionAudit.activeEffectIds).toContain("precise-denia-s2-fusion-applier-window");
    expect(fusionAudit.damage.status).toBe("supported");
    if (fusionAudit.damage.status === "supported" && fusionAudit.damage.formula === "standard-damage-v0.1") {
      expect(fusionAudit.damage.additionalElementalDamageBonusPercent).toBe(80);
    }

    const strain = run(2, "tune-strain");
    expect(strain.simulation.audits.some((audit) => audit.effectiveStats.tuneBreakBoost === 30)).toBe(true);
  });

  it("applies sequence damage growth while retaining explicit partial Team-Cycle diagnostics", () => {
    const s0 = run(0).simulation;
    const s1 = run(1).simulation;
    const s2 = run(2).simulation;
    const s3 = run(3).simulation;
    const s5 = run(5).simulation;
    expect(s1.personalDamage.expected).toBeGreaterThan(s0.personalDamage.expected);
    expect(s2.personalDamage.expected).toBeGreaterThan(s1.personalDamage.expected);
    expect(s3.personalDamage.expected).toBeGreaterThan(s2.personalDamage.expected);
    expect(s5.personalDamage.expected).toBeGreaterThan(s3.personalDamage.expected);
    expect(s5.partial).toBe(true);
    expect(s5.diagnostics.some((entry) => entry.code === "team-context-required" && entry.message.includes("denia-off-field"))).toBe(true);
  });

  it("keeps Fusion Burst and Tune Strain mode effects separate", () => {
    const fusion = run(0, "fusion-burst").simulation;
    const strain = run(0, "tune-strain").simulation;
    expect(fusion.audits.some((audit) => audit.damage.status === "supported" && audit.damage.formula === "standard-damage-v0.1" && audit.damage.additionalElementalDamageBonusPercent === 30)).toBe(true);
    expect(strain.audits.some((audit) => audit.effectiveStats.tuneBreakBoost === 10)).toBe(true);
  });
});
