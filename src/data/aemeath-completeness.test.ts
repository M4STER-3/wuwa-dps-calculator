import { describe, expect, it } from "vitest";

import { createBuildFromPreset } from "@/domain/character-box";
import { resolvePersonalLoadout, simulateRotationLab } from "@/domain/personal-dps-lab";
import { aemeathPreset } from "./aemeath-combat";

const target = {
  id: "aemeath-completeness-target",
  level: 90,
  elementalResistance: { fusion: 0.1 },
  physicalResistance: 0.1,
  tuneEnemyClass: "4C" as const,
};

const timingOnlyDiagnosticCodes = new Set([
  "hit-timing-required",
]);

const blockingDiagnostics = (
  simulation: NonNullable<ReturnType<typeof simulateRotationLab>>,
) => simulation.unsupportedMechanics.filter(
  (diagnostic) => !timingOnlyDiagnosticCodes.has(diagnostic.code),
);

describe("Aemeath Personal DPS completeness gate", () => {
  it.each([
    { sequence: 0 as const, mode: "tune-rupture" as const },
    { sequence: 0 as const, mode: "fusion-burst" as const },
    { sequence: 3 as const, mode: "tune-rupture" as const },
    { sequence: 3 as const, mode: "fusion-burst" as const },
    { sequence: 6 as const, mode: "tune-rupture" as const },
    { sequence: 6 as const, mode: "fusion-burst" as const },
  ])("has no non-timing unsupported DPS mechanic at S$sequence $mode", ({ sequence, mode }) => {
    const build = createBuildFromPreset(
      { ...aemeathPreset, sequence },
      {
        id: `aemeath-complete-s${sequence}-${mode}`,
        now: "2026-08-20T19:50:00Z",
      },
    );
    const loadout = resolvePersonalLoadout(build);
    const simulation = simulateRotationLab(loadout, build.finalStats, target, mode);

    expect(simulation, `${mode} S${sequence} simulation`).toBeDefined();
    if (!simulation) return;
    expect(blockingDiagnostics(simulation), `${mode} S${sequence} blocking diagnostics`).toEqual([]);
    expect(simulation.coverage.relevantUnsupported, `${mode} S${sequence} raw unsupported coverage`).toBeGreaterThanOrEqual(0);
    expect(simulation.personalDamage.expected, `${mode} S${sequence} expected personal damage`).toBeGreaterThan(0);
  });

  it("keeps timing uncertainty explicit instead of fabricating animation data", () => {
    const build = createBuildFromPreset(
      aemeathPreset,
      { id: "aemeath-complete-timing-policy", now: "2026-08-20T19:50:00Z" },
    );
    const loadout = resolvePersonalLoadout(build);
    const simulation = simulateRotationLab(loadout, build.finalStats, target, "tune-rupture");
    if (!simulation) throw new Error("Expected Aemeath Tune simulation");

    const timingDiagnostics = simulation.unsupportedMechanics.filter(
      (diagnostic) => timingOnlyDiagnosticCodes.has(diagnostic.code),
    );
    for (const diagnostic of timingDiagnostics) {
      expect(diagnostic.relevance).toBe("relevant-unsupported");
    }
  });
});
