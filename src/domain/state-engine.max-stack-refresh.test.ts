import { describe, expect, it } from "vitest";
import type { EffectDefinition } from "./effect-models";
import type { FinalStats } from "./models";
import { advanceState, emptyCombatState, processEvent } from "./state-engine";

const source = {
  id: "fixture-source",
  type: "system" as const,
  label: "Max-stack refresh fixture",
};

const effect: EffectDefinition = {
  id: "fixture-no-reset-at-max",
  label: "Fixture no reset at max stacks",
  source,
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 12 },
    refresh: "no-reset-at-max-stacks",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 2, initial: 0 },
  },
  rules: [],
  triggers: [{
    id: "fixture-stack-trigger",
    event: "custom",
    operations: [
      { kind: "activate-effect", effectId: "fixture-no-reset-at-max" },
      {
        kind: "gain-stacks",
        effectId: "fixture-no-reset-at-max",
        amount: { kind: "constant", value: 1 },
      },
    ],
  }],
};

const panelStats = {} as FinalStats;
const event = (timestamp: number) => ({
  id: `fixture-${timestamp}`,
  timestamp,
  kind: "custom" as const,
  ownerId: "actor",
  actorId: "actor",
  targetId: "target",
});

describe("state engine max-stack refresh policy", () => {
  it("refreshes while below cap but preserves expiry when a trigger lands at max stacks", () => {
    let state = emptyCombatState(
      { actor: { resources: {}, namedStates: [] } },
      ["target"],
    );

    let result = processEvent(state, event(0), [effect], { panelStats });
    state = result.state;
    let active = state.activeEffects.find(
      (entry) => entry.definition.id === effect.id,
    );
    expect(active?.stacks).toBe(1);
    expect(active?.expiresAt).toBe(12);

    result = processEvent(state, event(5), [effect], { panelStats });
    state = result.state;
    active = state.activeEffects.find((entry) => entry.definition.id === effect.id);
    expect(active?.stacks).toBe(2);
    expect(active?.expiresAt).toBe(17);
    expect(result.transitions.some((entry) => entry.kind === "effect-refreshed")).toBe(true);

    result = processEvent(state, event(10), [effect], { panelStats });
    state = result.state;
    active = state.activeEffects.find((entry) => entry.definition.id === effect.id);
    expect(active?.stacks).toBe(2);
    expect(active?.expiresAt).toBe(17);
    expect(result.transitions.some((entry) => entry.kind === "effect-refreshed")).toBe(false);
    expect(result.diagnostics).toEqual([]);

    const expired = advanceState(state, 17);
    expect(
      expired.state.activeEffects.some((entry) => entry.definition.id === effect.id),
    ).toBe(false);
  });
});
