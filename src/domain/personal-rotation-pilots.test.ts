import { describe, expect, it } from "vitest";

import { presets } from "@/data/catalog";
import { createBuildFromPreset } from "./character-box";
import {
  DEFAULT_LAB_TARGET,
  resolvePersonalLoadout,
  simulateRotationLab,
} from "./personal-dps-lab";

const buildFor = (resonatorId: string) => {
  const preset = presets.find((candidate) => candidate.resonatorId === resonatorId);
  if (!preset) throw new Error(`Missing pilot preset: ${resonatorId}`);
  return createBuildFromPreset(preset, {
    id: `pilot-${resonatorId}`,
    now: "2026-08-19T12:00:00Z",
  });
};

const runPilot = (resonatorId: string, resonanceMode?: string) => {
  const build = buildFor(resonatorId);
  const loadout = resolvePersonalLoadout(build);
  const result = simulateRotationLab(
    loadout,
    build.finalStats,
    DEFAULT_LAB_TARGET,
    resonanceMode,
  );
  if (!result) throw new Error(`Missing rotation result: ${resonatorId}/${resonanceMode ?? "default"}`);
  return result;
};

describe("universal Personal DPS — four pilot contract", () => {
  it.each([
    ["aemeath", "tune-rupture"],
    ["aemeath", "fusion-burst"],
    ["calcharo", undefined],
    ["chisa", undefined],
    ["verina", undefined],
  ] as const)("runs %s %s through the same rotation pipeline", (resonatorId, resonanceMode) => {
    const result = runPilot(resonatorId, resonanceMode);
    const failureContext = JSON.stringify({
      diagnostics: result.diagnostics,
      stateDiagnostics: result.stateDiagnostics,
      transitions: result.stateTransitions.slice(0, 20),
      events: result.eventLog.slice(0, 20),
    });

    expect(result.rotationDurationSeconds).toBeGreaterThan(0);
    expect(result.personalDamage.expected, failureContext).toBeGreaterThan(0);
    expect(result.personalDps.expected).toBeCloseTo(
      result.personalDamage.expected / result.rotationDurationSeconds,
      10,
    );
    expect(result.audits.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.some((diagnostic) =>
        diagnostic.code === "action-not-found" ||
        diagnostic.code === "formula-not-supported"
      ),
    ).toBe(false);
  });

  it("keeps Aemeath Tune and Fusion as distinct data-owned simulations", () => {
    const tune = runPilot("aemeath", "tune-rupture");
    const fusion = runPilot("aemeath", "fusion-burst");

    expect(tune.rotationDurationSeconds).toBeCloseTo(11.69, 8);
    expect(fusion.rotationDurationSeconds).toBeCloseTo(11.69, 8);
    expect(tune.breakdown.tune.expected).toBeGreaterThan(0);
    expect(fusion.breakdown.status.expected).toBeGreaterThan(0);
    expect(tune.personalDamage.expected).not.toBe(fusion.personalDamage.expected);
  });
});
