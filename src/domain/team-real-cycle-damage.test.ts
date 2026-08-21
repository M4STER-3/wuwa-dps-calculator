import { describe, expect, it } from "vitest";

import {
  mainEchoes,
  presets,
  resonators,
  sonatas,
  weapons,
} from "@/data/catalog";

import { createBuildFromPreset } from "./character-box";
import { simulateTeam } from "./team-engine";
import { adaptPersonalRotationToTeamBlock } from "./team-personal-rotation-adapter";
import {
  buildSequentialTeamCycle,
  buildTeamActorInputs,
} from "./team-rotation-builder";

const catalog = { resonators, weapons, sonatas, mainEchoes };
const target = {
  level: 90,
  elementalResistance: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  physicalResistance: 0,
};

const now = "2026-08-21T18:00:00.000Z";

describe("real Character Box automatic Team damage", () => {
  for (const preset of presets) {
    it(`${preset.resonatorId} resolves at least one damaging action`, () => {
      const build = createBuildFromPreset(preset, {
        id: `team-zero-dps-${preset.resonatorId}`,
        now,
      });
      const prepared = buildTeamActorInputs([build], catalog);
      expect(prepared.diagnostics).toEqual([]);
      expect(prepared.actors).toHaveLength(1);

      const actor = prepared.actors[0]!;
      const adapted = adaptPersonalRotationToTeamBlock(
        actor,
        actor.resonanceMode,
      );
      expect(adapted.diagnostics).toEqual([]);
      expect(
        adapted.rotation.steps.some((step) => step.kind === "action"),
      ).toBe(true);

      const cycle = buildSequentialTeamCycle([adapted.rotation]);
      expect(cycle.diagnostics).toEqual([]);

      const result = simulateTeam({
        actors: prepared.actors,
        activeActorId: cycle.startingActorId!,
        target,
        steps: cycle.steps,
      });

      const debug = {
        resonatorId: preset.resonatorId,
        mode: actor.resonanceMode,
        actionSteps: cycle.steps.filter((step) => step.kind === "action").length,
        damageEvents: result.damageEvents.length,
        resolvedDurationSeconds: result.resolvedDurationSeconds,
        totalExpectedDamage: result.totalResolvedDamage.expected,
        diagnostics: result.diagnostics.map(
          (diagnostic) => `${diagnostic.code}:${diagnostic.message}`,
        ),
      };

      expect(result.totalResolvedDamage.expected, JSON.stringify(debug)).toBeGreaterThan(0);
    });
  }
});
