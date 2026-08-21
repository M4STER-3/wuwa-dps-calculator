import { describe, expect, it } from "vitest";
import type { EffectDefinition } from "./effect-models";
import type { FinalStats } from "./models";
import { emptyCombatState, processEvent, type ActiveRuntimeEffect } from "./state-engine";

const source = {
  id: "fixture-source",
  type: "system" as const,
  label: "Same-event stack fixture",
};

const stackingEffect: EffectDefinition = {
  id: "fixture-stacking-effect",
  label: "Fixture stacking effect",
  source,
  target: "self",
  activationPolicy: "triggered",
  rules: [],
  lifecycle: {
    duration: { kind: "indefinite" },
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  triggers: [
    {
      id: "fixture-gain-third-stack",
      event: "custom",
      operations: [
        {
          kind: "gain-stacks",
          effectId: "fixture-stacking-effect",
          amount: { kind: "constant", value: 1 },
        },
      ],
    },
  ],
};

const thresholdEffect: EffectDefinition = {
  id: "fixture-threshold-effect",
  label: "Fixture threshold effect",
  source,
  target: "self",
  activationPolicy: "triggered",
  rules: [],
  lifecycle: { duration: { kind: "fixed", seconds: 15 } },
  triggers: [
    {
      id: "fixture-activate-at-three",
      event: "custom",
      predicates: [
        { kind: "has-effect", id: "fixture-stacking-effect", minStacks: 3 },
      ],
      operations: [
        { kind: "activate-effect", effectId: "fixture-threshold-effect" },
      ],
    },
  ],
};

const activeStackingEffect: ActiveRuntimeEffect = {
  id: "fixture-stacking-effect:actor:setup",
  definition: stackingEffect,
  ownerId: "actor",
  stacks: 2,
  activatedAt: 0,
};

const panelStats = {} as FinalStats;

describe("state engine same-event stack context", () => {
  it("lets a later trigger observe the stack gained by an earlier trigger on the same event", () => {
    const initial = {
      ...emptyCombatState({ actor: { resources: {}, namedStates: [] } }, ["target"]),
      activeEffects: [activeStackingEffect],
    };

    const result = processEvent(
      initial,
      {
        id: "fixture-event",
        timestamp: 1,
        kind: "custom",
        ownerId: "actor",
        actorId: "actor",
        targetId: "target",
      },
      [stackingEffect, thresholdEffect],
      { panelStats },
    );

    expect(
      result.state.activeEffects.find(
        (effect) => effect.definition.id === "fixture-stacking-effect",
      )?.stacks,
    ).toBe(3);
    expect(
      result.state.activeEffects.some(
        (effect) => effect.definition.id === "fixture-threshold-effect",
      ),
    ).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
});
