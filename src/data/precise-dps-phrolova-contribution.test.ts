import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import {
  PHROLOVA_EXACT_CYCLE_SECONDS,
  runPhrolovaContributionCycle,
} from "./precise-dps-phrolova-contribution";
import { PHROLOVA } from "./precise-dps-phrolova";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1137,
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
    id: `phrolova-s${sequence}`,
    resonatorId: "phrolova",
    sourcePresetId: "precise-phrolova-contribution",
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
    finalStats: stats,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

function run(sequence: Sequence = 0) {
  const resonator = findPreciseDpsResonator("phrolova")!;
  const weapon = findPreciseDpsWeapon("phrolova")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === "phrolova-opener-boss")!;
  return runPhrolovaContributionCycle({
    scenario,
    resonator,
    build: build(sequence, weapon.id),
    stats,
    target: { level: 90, elementalResistance: { havoc: 0.1 }, physicalResistance: 0.1 },
    weapon,
    baseStatBasis: {
      attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
    teamEchoTriggers: [
      { timeSeconds: 2, echoName: "Echo Alpha", triggeringActorId: "ally-a" },
      { timeSeconds: 5, echoName: "Echo Beta", triggeringActorId: "ally-b" },
      { timeSeconds: 8, echoName: "Echo Gamma", triggeringActorId: "ally-a" },
    ],
  });
}

describe("Phrolova exact contribution cycle", () => {
  it("uses an exact 25s denominator while retaining theoretical on/off-field timing", () => {
    const result = run(0);
    expect(result.cycleDurationSeconds).toBe(PHROLOVA_EXACT_CYCLE_SECONDS);
    expect(result.onFieldDurationSeconds).toBeGreaterThan(0);
    expect(result.offFieldDurationSeconds).toBeGreaterThan(0);
    expect(result.onFieldDurationSeconds + result.offFieldDurationSeconds).toBeCloseTo(25, 10);
    expect(result.maestroScheduledDurationSeconds).toBeLessThanOrEqual(24);
    expect(result.contributionDps.expected).toBeCloseTo(result.totalDamage.expected / 25, 10);
  });

  it("adds real Hecate off-field damage to Phrolova instead of ending damage at the switch", () => {
    const result = run(0);
    expect(result.onField.personalDamage.expected).toBeGreaterThan(0);
    expect(result.offField.personalDamage.expected).toBeGreaterThan(0);
    expect(result.totalDamage.expected).toBeGreaterThan(result.onField.personalDamage.expected);
    expect(result.offField.perAction[PHROLOVA.hecateBasic1]?.expected ?? 0).toBeGreaterThan(0);
    expect(
      (result.offField.perAction[PHROLOVA.hecateStrings]?.expected ?? 0) +
      (result.offField.perAction[PHROLOVA.hecateWinds]?.expected ?? 0) +
      (result.offField.perAction[PHROLOVA.hecateCadenza]?.expected ?? 0),
    ).toBeGreaterThan(0);
  });

  it("preserves Phrolova ownership/scaling for every Hecate damage audit", () => {
    const result = run(0);
    expect(result.offField.audits.length).toBeGreaterThan(0);
    for (const audit of result.offField.audits) {
      expect(audit.damageOwnerId).toBe("phrolova");
      expect(audit.scalingOwnerId).toBe("phrolova");
      expect(audit.activeEffectIds).toContain("precise-phrolova-maestro-runtime");
    }
  });

  it("uses exact off-field Enhanced Hecate events to grow Aftersound", () => {
    const result = run(0);
    expect(result.maestroSchedule.acceptedTeamEchoTriggers).toHaveLength(3);
    // S0 opener starts at exact Octet 10; Outro adds two Enhanced Hecate and the
    // explicit team context adds three more. Automatic Hecate basics add none.
    expect(result.finalAftersound).toBe(15);
  });

  it("routes S2 overflow beyond 24 Aftersound into the persistent CRIT-DMG ramp", () => {
    const result = run(2);
    expect(result.finalAftersound).toBe(24);
    // S2 Scarlet reaches 24 exactly from the 10-stack opener bootstrap. The five
    // off-field Enhanced Hecate attacks then become five overflow CRIT stacks.
    expect(result.finalAftersoundOverflowCrit).toBe(5);
  });

  it("is complete for the opener when exact teammate Echo events are supplied", () => {
    const result = run(0);
    if (result.partial) {
      throw new Error(
        `PHROLOVA_CONTRIBUTION_PARTIAL=${JSON.stringify({
          diagnostics: result.diagnostics,
          onField: result.onField.unsupportedMechanics,
          offField: result.offField.unsupportedMechanics,
          state: [...result.onField.stateDiagnostics, ...result.offField.stateDiagnostics],
        })}`,
      );
    }
    expect(result.partial).toBe(false);
  });
});
