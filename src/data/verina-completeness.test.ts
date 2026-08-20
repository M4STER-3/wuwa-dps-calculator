import { describe, expect, it } from "vitest";

import { createBuildFromPreset } from "@/domain/character-box";
import { calculateActionOutcomes } from "@/domain/action-outcome-engine";
import { resolvePersonalLoadout, simulateRotationLab } from "@/domain/personal-dps-lab";
import type { FinalStats } from "@/domain/models";
import {
  fallacyOfNoReturn,
  rejuvenatingGlow,
  verina,
  verinaActions,
  verinaPreset,
} from "./verina-complete";

const target = {
  id: "verina-completeness-target",
  level: 90,
  elementalResistance: { spectro: 0.1 },
  physicalResistance: 0.1,
  tuneEnemyClass: "4C" as const,
};

const timingOnlyDiagnosticCodes = new Set(["hit-timing-required"]);

const blockingDiagnostics = (
  simulation: NonNullable<ReturnType<typeof simulateRotationLab>>,
) => simulation.unsupportedMechanics.filter(
  (diagnostic) => !timingOnlyDiagnosticCodes.has(diagnostic.code),
);

const outcomeStats: FinalStats = {
  hp: 14237.5,
  attack: 1000,
  defense: 1099.98,
  critRate: 5,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  damageTypeBonus: {
    basicAttack: 0,
    heavyAttack: 0,
    resonanceSkill: 0,
    resonanceLiberation: 0,
    introSkill: 0,
    echoSkill: 0,
  },
};

const structured = (id: string) =>
  verina.combat?.effects.find((effect) => effect.id === id)?.structuredEffect;

describe("Verina completion accounting", () => {
  it("folds permanent minor Fortes into finalStats exactly once", () => {
    expect(verinaPreset).toMatchObject({
      characterLevel: 90,
      sequence: 0,
      progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
      weapon: { weaponId: "variation", level: 90, rank: 1 },
      sonataId: "rejuvenating-glow",
      mainEchoId: "fallacy-of-no-return",
    });
    expect(verinaPreset.finalStats.attack).toBeCloseTo(755.44, 8);
    expect(verinaPreset.finalStats.energyRegen).toBe(151.8);
    expect(verinaPreset.finalStats.healingBonus).toBe(22);
  });

  it("keeps temporary team buffs runtime-only and team-scoped", () => {
    expect(structured("verina-gift-of-nature-team")).toMatchObject({
      target: "team",
      lifecycle: { duration: { kind: "fixed", seconds: 20 } },
    });
    expect(structured("verina-s4-spectro-team")).toMatchObject({
      target: "team",
      lifecycle: { duration: { kind: "fixed", seconds: 24 } },
    });

    const rejuvenating = rejuvenatingGlow.effects?.find(
      (effect) => effect.id === "rejuvenating-glow-5pc-team",
    )?.structuredEffect;
    expect(rejuvenating).toMatchObject({
      target: "team",
      lifecycle: { duration: { kind: "fixed", seconds: 30 } },
    });

    const fallacyEffects = fallacyOfNoReturn.effects?.map(
      (effect) => effect.structuredEffect,
    );
    expect(fallacyEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fallacy-energy-regen-self", target: "self" }),
        expect.objectContaining({ id: "fallacy-team-atk", target: "team" }),
      ]),
    );
  });

  it("executes the verified Mid-air Starflower heal", () => {
    const action = verinaActions.find(
      (candidate) => candidate.id === "verina-starflower-midair",
    );
    expect(action?.outcomes).toBeDefined();
    expect(calculateActionOutcomes(action?.outcomes, 10, outcomeStats).outcomes[0]).toMatchObject({
      kind: "healing",
      amount: 1485.5,
    });
  });
});

describe("Verina Personal DPS completeness gate", () => {
  it.each([0, 4, 6] as const)(
    "has no non-timing unsupported DPS mechanic at S%s",
    (sequence) => {
      const build = createBuildFromPreset(
        { ...verinaPreset, sequence },
        {
          id: `verina-complete-s${sequence}`,
          now: "2026-08-21T00:35:00+02:00",
        },
      );
      const loadout = resolvePersonalLoadout(build);
      const simulation = simulateRotationLab(loadout, build.finalStats, target);

      expect(simulation, `S${sequence} simulation`).toBeDefined();
      if (!simulation) return;
      expect(
        blockingDiagnostics(simulation),
        `S${sequence} blocking diagnostics`,
      ).toEqual([]);
      expect(simulation.personalDamage.expected).toBeGreaterThan(0);
    },
  );

  it("keeps timing uncertainty explicit instead of inventing animation frames", () => {
    const build = createBuildFromPreset(verinaPreset, {
      id: "verina-complete-timing-policy",
      now: "2026-08-21T00:35:00+02:00",
    });
    const loadout = resolvePersonalLoadout(build);
    const simulation = simulateRotationLab(loadout, build.finalStats, target);
    if (!simulation) throw new Error("Expected Verina simulation");

    for (const diagnostic of simulation.unsupportedMechanics.filter((item) =>
      timingOnlyDiagnosticCodes.has(item.code),
    )) {
      expect(diagnostic.relevance).toBe("relevant-unsupported");
    }
  });
});
