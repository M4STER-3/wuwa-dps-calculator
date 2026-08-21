import { describe, expect, it } from "vitest";

import {
  mainEchoes,
  presets,
  resonators,
  sonatas,
  weapons,
} from "@/data/catalog";

import { createBuildFromPreset } from "./character-box";
import { validateTeamCycle } from "./team-dps-cycle";
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

function aemeathAutomaticInput() {
  const preset = presets.find(
    (candidate) =>
      candidate.resonatorId === "aemeath" &&
      candidate.source.kind !== "technical-fixture",
  );
  if (!preset) throw new Error("Missing real Aemeath preset.");
  const build = createBuildFromPreset(preset, {
    id: "team-personal-event-aemeath",
    now: "2026-08-21T18:30:00.000Z",
  });
  const prepared = buildTeamActorInputs([build], catalog);
  expect(prepared.diagnostics).toEqual([]);
  const actor = prepared.actors[0]!;
  const adapted = adaptPersonalRotationToTeamBlock(
    actor,
    actor.resonanceMode,
  );
  expect(adapted.diagnostics).toEqual([]);
  expect(adapted.scenarioEvents.length).toBeGreaterThan(0);
  const cycle = buildSequentialTeamCycle([adapted.rotation]);
  expect(cycle.diagnostics).toEqual([]);
  return { actor, adapted, cycle };
}

describe("automatic Personal scenario events in Team", () => {
  it("injects the same actor-owned scenario events into cycle 1 and replays them in cycle 2", () => {
    const { actor, adapted, cycle } = aemeathAutomaticInput();
    const result = validateTeamCycle({
      actors: [actor],
      activeActorId: cycle.startingActorId!,
      target,
      steps: cycle.steps,
    });

    const cycle1Events = result.cycle1.eventLog.filter(
      (event) =>
        event.external && event.payload?.scenarioId === adapted.scenarioId,
    );
    const cycle2Events = result.cycle2.eventLog.filter(
      (event) =>
        event.external && event.payload?.scenarioId === adapted.scenarioId,
    );

    expect(cycle1Events).toHaveLength(adapted.scenarioEvents.length);
    expect(cycle2Events).toHaveLength(adapted.scenarioEvents.length);
    expect(
      cycle1Events.every(
        (event) =>
          event.actorId === actor.actorId && event.ownerId === actor.actorId,
      ),
    ).toBe(true);
    expect(
      cycle2Events.every(
        (event) =>
          event.actorId === actor.actorId && event.ownerId === actor.actorId,
      ),
    ).toBe(true);

    const firstCycle1 = cycle1Events[0]!;
    const firstCycle2 = cycle2Events.find(
      (event) => event.occurrence === firstCycle1.occurrence,
    );
    expect(firstCycle2).toBeDefined();
    expect(result.cycle1.resolvedDurationSeconds).toBeDefined();
    expect(firstCycle2!.timestamp - firstCycle1.timestamp).toBeCloseTo(
      result.cycle1.resolvedDurationSeconds!,
      8,
    );
  });

  it("does not inject Personal scenario events into an authored manual Team rotation", () => {
    const { actor, adapted } = aemeathAutomaticInput();
    const result = validateTeamCycle({
      actors: [actor],
      activeActorId: actor.actorId,
      target,
      steps: [{ kind: "wait", seconds: 0.25 }],
    });

    expect(
      result.cycle1.eventLog.some(
        (event) =>
          event.external && event.payload?.scenarioId === adapted.scenarioId,
      ),
    ).toBe(false);
  });
});
