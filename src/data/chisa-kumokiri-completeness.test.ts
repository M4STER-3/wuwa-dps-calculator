import { describe, expect, it } from "vitest";
import type { EffectDefinition, StatusDefinition } from "@/domain/effect-models";
import { emptyCombatState, processEvent, type CombatState } from "@/domain/state-engine";
import { chisaPreset, kumokiri } from "./chisa-combat";

const definitions = (kumokiri.effects ?? [])
  .map((effect) => effect.structuredEffect)
  .filter((effect): effect is EffectDefinition => Boolean(effect));

const unseenSnare: StatusDefinition = {
  id: "unseen-snare",
  label: "Unseen Snare fixture",
  maxStacks: 1,
};

const withUnseenSnare = (state: CombatState): CombatState => ({
  ...state,
  targets: {
    ...state.targets,
    target: {
      ...(state.targets.target ?? { statuses: {}, marks: {} }),
      statuses: {
        ...(state.targets.target?.statuses ?? {}),
        "unseen-snare": {
          stacks: 1,
          definition: unseenSnare,
          sourceOwnerId: "chisa",
        },
      },
    },
  },
});

describe("Chisa Kumokiri completion", () => {
  it("keeps the max-stack bonus runtime-only and activates it on the third Negative Status event", () => {
    const stackDefinition = definitions.find((effect) => effect.id === "kumokiri-r1-runtime");
    const bonusDefinition = definitions.find(
      (effect) => effect.id === "kumokiri-r1-max-stacks-all-attribute",
    );

    expect(stackDefinition?.lifecycle?.stacks).toMatchObject({ max: 3 });
    expect(bonusDefinition?.lifecycle?.duration).toEqual({ kind: "fixed", seconds: 15 });
    expect(bonusDefinition?.rules[0]?.modifiers[0]).toMatchObject({
      kind: "all-damage-bonus",
      value: 24,
    });
    expect(bonusDefinition?.triggers?.[0]?.predicates).toContainEqual({
      kind: "has-effect",
      id: "kumokiri-r1-runtime",
      minStacks: 3,
    });

    let state = withUnseenSnare(
      emptyCombatState({ chisa: { resources: {}, namedStates: [] } }, ["target"]),
    );

    for (let index = 1; index <= 2; index += 1) {
      state = processEvent(
        state,
        {
          id: `negative-status-${index}`,
          timestamp: index,
          kind: "status-applied",
          ownerId: "chisa",
          actorId: "chisa",
          targetId: "target",
          sourceId: "unseen-snare",
        },
        definitions,
        { panelStats: chisaPreset.finalStats },
      ).state;
    }

    expect(
      state.activeEffects.find((effect) => effect.definition.id === "kumokiri-r1-runtime")
        ?.stacks,
    ).toBe(2);
    expect(
      state.activeEffects.some(
        (effect) => effect.definition.id === "kumokiri-r1-max-stacks-all-attribute",
      ),
    ).toBe(false);

    state = processEvent(
      state,
      {
        id: "negative-status-3",
        timestamp: 3,
        kind: "status-applied",
        ownerId: "chisa",
        actorId: "chisa",
        targetId: "target",
        sourceId: "unseen-snare",
      },
      definitions,
      { panelStats: chisaPreset.finalStats },
    ).state;

    expect(
      state.activeEffects.find((effect) => effect.definition.id === "kumokiri-r1-runtime")
        ?.stacks,
    ).toBe(3);
    expect(
      state.activeEffects.some(
        (effect) => effect.definition.id === "kumokiri-r1-max-stacks-all-attribute",
      ),
    ).toBe(true);
  });
});
