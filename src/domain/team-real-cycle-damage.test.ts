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
const realPresets = presets.filter(
  (preset) => preset.source.kind !== "technical-fixture",
);

function buildFor(resonatorId: string, id: string) {
  const preset = realPresets.find(
    (candidate) => candidate.resonatorId === resonatorId,
  );
  if (!preset) throw new Error(`Missing real preset for ${resonatorId}.`);
  return createBuildFromPreset(preset, { id, now });
}

function debugResult(result: ReturnType<typeof simulateTeam>) {
  return {
    damageEvents: result.damageEvents.length,
    resolvedDurationSeconds: result.resolvedDurationSeconds,
    totalExpectedDamage: result.totalResolvedDamage.expected,
    diagnostics: result.diagnostics.map(
      (diagnostic) => `${diagnostic.code}:${diagnostic.message}`,
    ),
  };
}

describe("real Character Box automatic Team damage", () => {
  for (const preset of realPresets) {
    it(`${preset.resonatorId} resolves at least one damaging action`, () => {
      const build = createBuildFromPreset(preset, {
        id: `team-zero-dps-${preset.resonatorId}-${preset.id}`,
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

      expect(
        result.totalResolvedDamage.expected,
        JSON.stringify({
          presetId: preset.id,
          resonatorId: preset.resonatorId,
          mode: actor.resonanceMode,
          actionSteps: cycle.steps.filter((step) => step.kind === "action").length,
          ...debugResult(result),
        }),
      ).toBeGreaterThan(0);
    });
  }

  it("resolves damage for the Galbrena -> Qiuyuan -> Aemeath automatic loop", () => {
    const builds = [
      buildFor("galbrena", "team-zero-galbrena"),
      buildFor("qiuyuan", "team-zero-qiuyuan"),
      buildFor("aemeath", "team-zero-aemeath"),
    ];
    const actorIdsByBuildId = {
      "team-zero-galbrena": "slot-1",
      "team-zero-qiuyuan": "slot-2",
      "team-zero-aemeath": "slot-3",
    };
    const prepared = buildTeamActorInputs(
      builds,
      catalog,
      {},
      actorIdsByBuildId,
    );
    expect(prepared.diagnostics).toEqual([]);

    const rotations = prepared.actors.map((actor) =>
      adaptPersonalRotationToTeamBlock(actor, actor.resonanceMode),
    );
    expect(rotations.flatMap((rotation) => rotation.diagnostics)).toEqual([]);

    const cycle = buildSequentialTeamCycle(
      rotations.map((rotation) => rotation.rotation),
    );
    expect(cycle.diagnostics).toEqual([]);

    const result = simulateTeam({
      actors: prepared.actors,
      activeActorId: cycle.startingActorId!,
      target,
      steps: cycle.steps,
    });

    expect(
      result.totalResolvedDamage.expected,
      JSON.stringify({
        actorOrder: cycle.actorOrder,
        actionSteps: cycle.steps.filter((step) => step.kind === "action").length,
        ...debugResult(result),
      }),
    ).toBeGreaterThan(0);
  });
});
