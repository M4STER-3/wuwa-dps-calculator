import { describe, expect, it } from "vitest";

import { mainEchoes, presets, resonators, sonatas, weapons } from "@/data/catalog";

import { createBuildFromPreset, parseCharacterBox } from "./character-box";
import { selectPersonalRotationScenario } from "./personal-rotation-selection";
import { adaptPersonalRotationToTeamBlock } from "./team-personal-rotation-adapter";
import { buildTeamActorInputs } from "./team-rotation-builder";

const catalog = { resonators, weapons, sonatas, mainEchoes };
const now = "2026-08-21T18:30:00.000Z";

describe("shared Personal scenario context", () => {
  it("persists the exact Denia build variant and reuses it in Personal and Team", () => {
    const deniaPresets = presets.filter(
      (preset) =>
        preset.resonatorId === "denia" &&
        preset.source.kind !== "technical-fixture",
    );

    expect(
      deniaPresets.map((preset) => preset.personalScenarioId).sort(),
    ).toEqual(["denia-fusion-burst", "denia-tune-strain"]);

    for (const [index, preset] of deniaPresets.entries()) {
      const build = createBuildFromPreset(preset, {
        id: `shared-scenario-denia-${index}`,
        now,
      });
      expect(build.personalScenarioId).toBe(preset.personalScenarioId);

      const restored = parseCharacterBox(
        JSON.stringify({ schemaVersion: 1, builds: [build] }),
      ).builds[0]!;
      expect(restored.personalScenarioId).toBe(preset.personalScenarioId);

      const selectedForPersonal = selectPersonalRotationScenario(
        restored.resonatorId,
        undefined,
        restored.personalScenarioId,
      );
      expect(selectedForPersonal?.id).toBe(restored.personalScenarioId);

      const prepared = buildTeamActorInputs([restored], catalog);
      expect(prepared.diagnostics).toEqual([]);
      expect(prepared.actors).toHaveLength(1);
      const actor = prepared.actors[0]!;

      const selectedForTeam = selectPersonalRotationScenario(
        actor.resonator.id,
        actor.resonanceMode,
        actor.build.personalScenarioId,
      );
      expect(selectedForTeam?.id).toBe(restored.personalScenarioId);
      expect(actor.resonanceMode).toBe(selectedForPersonal?.resonanceMode);

      const adapted = adaptPersonalRotationToTeamBlock(
        actor,
        actor.resonanceMode,
      );
      expect(adapted.diagnostics).toEqual([]);
      expect(adapted.scenarioId).toBe(restored.personalScenarioId);
      expect(adapted.resonanceMode).toBe(selectedForPersonal?.resonanceMode);
    }
  });

  it("keeps legacy Character Box builds valid when no scenario identity was persisted", () => {
    const preset = presets.find(
      (candidate) =>
        candidate.resonatorId === "chisa" &&
        candidate.source.kind !== "technical-fixture",
    );
    if (!preset) throw new Error("Missing Chisa preset.");

    const build = createBuildFromPreset(preset, {
      id: "shared-scenario-legacy",
      now,
    });
    const legacyBuild = { ...build };
    delete legacyBuild.personalScenarioId;

    const restored = parseCharacterBox(
      JSON.stringify({ schemaVersion: 1, builds: [legacyBuild] }),
    );
    expect(restored.builds).toHaveLength(1);
    expect(restored.builds[0]!.personalScenarioId).toBeUndefined();
  });
});
