import { describe, expect, it } from "vitest";
import type { FinalStats, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { preciseDpsFutureResonators, preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsWeapon } from "./precise-dps-loadouts";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 3000,
  critRate: 5,
  critDamage: 150,
  energyRegen: 260,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function runLynae(rank: 1 | 5) {
  const resonator = preciseDpsFutureResonators.find((entry) => entry.id === "lynae")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === "lynae-tune-rupture")!;
  const weapon = findPreciseDpsWeapon("lynae")!;
  const build: UserBuild = {
    id: `lynae-r${rank}`,
    resonatorId: "lynae",
    sourcePresetId: "precise-weapon-runtime",
    characterLevel: 90,
    sequence: 0,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId: weapon.id, level: 90, rank },
    finalStats: stats,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build,
    stats,
    target: { level: 90, elementalResistance: {}, physicalResistance: 0 },
    weapon,
    actions: resonator.combat!.actions,
    baseStatBasis: {
      attack: resonator.baseStats?.[0]?.attack,
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
  }).simulation;
}

describe("precise DPS signature weapon runtime", () => {
  it("materializes Spectrum Blaster R1/R5 inside the universal rotation runner", () => {
    const r1 = runLynae(1);
    const r5 = runLynae(5);
    expect(r5.personalDamage.expected).toBeGreaterThan(r1.personalDamage.expected);
    const r1Spectrum = r1.audits.flatMap((audit) => audit.effectAudit).filter((audit) => audit.effectId.includes("spectrum-blaster"));
    const r5Spectrum = r5.audits.flatMap((audit) => audit.effectAudit).filter((audit) => audit.effectId.includes("spectrum-blaster"));
    expect(r1Spectrum.some((audit) => audit.status === "matched")).toBe(true);
    expect(r5Spectrum.some((audit) => audit.status === "matched")).toBe(true);
    expect(r5.diagnostics.some((diagnostic) => diagnostic.code === "missing-rank-value")).toBe(false);
  });
});
