import { describe, expect, it } from "vitest";

import {
  mainEchoes,
  presets,
  resonators,
  sonatas,
  weapons,
} from "@/data/catalog";

import { createBuildFromPreset } from "./character-box";
import { selectPersonalRotationScenario } from "./personal-rotation-selection";
import { adaptPersonalRotationToTeamBlock } from "./team-personal-rotation-adapter";
import {
  buildSequentialTeamCycle,
  buildTeamActorInputs,
  walkRotationActiveActors,
} from "./team-rotation-builder";

function buildFor(resonatorId: string, id: string) {
  const preset = presets.find((candidate) => candidate.resonatorId === resonatorId);
  if (!preset) throw new Error(`Missing test preset for ${resonatorId}.`);
  return createBuildFromPreset(preset, {
    id,
    now: "2026-08-21T16:30:00.000Z",
  });
}

const catalog = { resonators, weapons, sonatas, mainEchoes };

describe("Personal DPS -> Team rotation adapter", () => {
  it("reuses the Personal scenario, preserves its duration, and leaves Intro/Outro execution to Team switches", () => {
    const build = buildFor("aemeath", "team-aemeath");
    const prepared = buildTeamActorInputs(
      [build],
      catalog,
      {},
      { "team-aemeath": "slot-2" },
    );
    expect(prepared.diagnostics).toEqual([]);

    const actor = prepared.actors[0]!;
    const adapted = adaptPersonalRotationToTeamBlock(actor, "fusion-burst");

    expect(adapted.diagnostics).toEqual([]);
    expect(adapted.actorId).toBe("slot-2");
    expect(adapted.resonanceMode).toBe("fusion-burst");
    expect(adapted.scenarioId).toBe(
      selectPersonalRotationScenario("aemeath", "fusion-burst")?.id,
    );
    expect(adapted.rotation.steps.length).toBeGreaterThan(0);
    expect(adapted.rotation.steps.some((step) => step.kind === "wait")).toBe(true);

    const runtimeActions = new Map(
      [
        ...(actor.resonator.combat?.actions ?? []),
        ...(actor.mainEcho?.action ? [actor.mainEcho.action] : []),
      ].map((action) => [action.id, action]),
    );

    for (const step of adapted.rotation.steps) {
      if (step.kind !== "action") continue;
      expect(step.durationOverrideSeconds).toBeGreaterThan(0);
      expect(runtimeActions.get(step.actionId)?.talent).not.toBe("introSkill");
      expect(runtimeActions.get(step.actionId)?.talent).not.toBe("outroSkill");
    }

    if (actor.mainEcho?.action) {
      expect(
        adapted.rotation.steps.some(
          (step) =>
            step.kind === "action" && step.actionId === actor.mainEcho!.action!.id,
        ),
      ).toBe(true);
    }

    expect(adapted.teamBlockDurationSeconds).toBeCloseTo(
      adapted.sourceDurationSeconds!,
      8,
    );
  });

  it("compiles three real Character Box rotations in arbitrary slot order as P1 -> P2 -> P3 -> P1", () => {
    const builds = [
      buildFor("galbrena", "team-galbrena"),
      buildFor("qiuyuan", "team-qiuyuan"),
      buildFor("aemeath", "team-aemeath"),
    ];
    const prepared = buildTeamActorInputs(builds, catalog, {}, {
      "team-galbrena": "slot-1",
      "team-qiuyuan": "slot-2",
      "team-aemeath": "slot-3",
    });
    expect(prepared.diagnostics).toEqual([]);

    const blocks = prepared.actors.map((actor) =>
      adaptPersonalRotationToTeamBlock(
        actor,
        actor.resonator.id === "aemeath" ? "tune-rupture" : undefined,
      ),
    );
    expect(blocks.flatMap((block) => block.diagnostics)).toEqual([]);

    const cycle = buildSequentialTeamCycle(
      blocks.map((block) => block.rotation),
    );
    expect(cycle.diagnostics).toEqual([]);
    expect(cycle.actorOrder).toEqual(["slot-1", "slot-2", "slot-3"]);
    expect(cycle.startingActorId).toBe("slot-1");
    expect(
      cycle.steps
        .filter((step) => step.kind === "switch")
        .map((step) => step.toActorId),
    ).toEqual(["slot-2", "slot-3", "slot-1"]);

    const activeByStep = walkRotationActiveActors("slot-1", cycle.steps);
    cycle.steps.forEach((step, index) => {
      if (step.kind === "action") {
        expect(step.actorId).toBe(activeByStep[index]);
      }
    });
  });
});
