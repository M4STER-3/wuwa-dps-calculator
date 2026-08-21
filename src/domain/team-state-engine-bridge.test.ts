import { describe, expect, it } from "vitest";

import type { EffectDefinition, TriggerDefinition } from "./effect-models";
import type { CombatAction, FinalStats, Resonator, UserBuild } from "./models";
import { createTeamState, type TeamActorInput } from "./team-engine";
import { applyTeamStructuredTrigger, advanceTeamRuntime } from "./team-state-engine-bridge";
import type { CombatEvent } from "./state-engine";

const source = { kind: "technical-fixture" as const, source: "team state bridge test" };
const stats: FinalStats = {
  hp: 1000,
  attack: 100,
  defense: 100,
  critRate: 0,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: {
    basicAttack: 0,
    heavyAttack: 0,
    resonanceSkill: 0,
    resonanceLiberation: 0,
    introSkill: 0,
    echoSkill: 0,
  },
};

const emittedAction: CombatAction = {
  id: "derived-hit",
  name: "Derived hit",
  talent: "basicAttack",
  damageType: "basicAttack",
  level: 1,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 0, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0], confidence: "technical-fixture" },
  source,
};

function actor(actorId: string, effects: readonly EffectDefinition[]): TeamActorInput {
  const resonator: Resonator = {
    id: `res-${actorId}`,
    name: actorId,
    element: "spectro",
    weaponType: "rectifier",
    rarity: 5,
    skillNames: {
      basicAttack: "",
      resonanceSkill: "",
      forteCircuit: "",
      resonanceLiberation: "",
      introSkill: "",
    },
    resonanceChain: [],
    combat: {
      level10Only: false,
      forms: ["normal", "empowered"],
      defaultForm: "normal",
      modes: [],
      resources: [{ id: "gauge", name: "Gauge", cap: 10, semantic: "character-resource", notes: [] }],
      actions: [emittedAction],
      effects: [],
      rotations: [],
      unknowns: [],
      source,
    },
    source,
  };
  const build: UserBuild = {
    id: `build-${actorId}`,
    resonatorId: resonator.id,
    sourcePresetId: "fixture",
    characterLevel: 90,
    sequence: 0,
    skillLevels: {
      basicAttack: 1,
      resonanceSkill: 1,
      forteCircuit: 1,
      resonanceLiberation: 1,
      introSkill: 1,
    },
    weapon: { weaponId: "fixture", level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "",
    updatedAt: "",
  };
  return { actorId, resonator, build, effects };
}

const activeBuff: EffectDefinition = {
  id: "runtime-buff",
  label: "Runtime buff",
  source: { id: "fixture", type: "system", label: "Fixture" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 2 },
    stacks: { kind: "shared", max: 5, initial: 0 },
  },
  rules: [],
};

const trigger: TriggerDefinition = {
  id: "universal-ops",
  event: "action-start",
  cooldown: { seconds: 1, scope: "action-target" },
  operations: [
    { kind: "activate-effect", effectId: "runtime-buff" },
    { kind: "gain-stacks", effectId: "runtime-buff", amount: { kind: "constant", value: 2 } },
    { kind: "resource", operation: "gain", resourceId: "gauge", amount: { kind: "constant", value: 3 } },
    { kind: "enter-state", stateId: "powered" },
    { kind: "change-form", stateId: "empowered" },
    { kind: "apply-status", statusId: "mark", stacks: { kind: "constant", value: 1 } },
    { kind: "emit-event", eventKind: "custom", delaySeconds: 0.25 },
    {
      kind: "emit-action",
      action: {
        actionId: "derived-hit",
        delaySeconds: 0.5,
        attribution: "follow-up",
        snapshot: { stats: "hit", stacks: "tick" },
      },
    },
  ],
};

const sourceEffect: EffectDefinition = {
  id: "source-effect",
  label: "Source effect",
  source: { id: "fixture", type: "system", label: "Fixture" },
  target: "self",
  activationPolicy: "triggered",
  rules: [],
  statuses: [{ id: "mark", label: "Mark", maxStacks: 3, durationSeconds: 1 }],
  triggers: [trigger],
};

function event(actorId: string, timestamp = 0): CombatEvent {
  return {
    id: `event-${actorId}-${timestamp}`,
    timestamp,
    kind: "action-start",
    ownerId: actorId,
    actorId,
    targetId: "target",
    actionId: "starter",
  };
}

describe("Team State Engine bridge", () => {
  it("executes the canonical structured operation language for an arbitrary actor id", () => {
    const inputActor = actor("slot-any-name", [sourceEffect, activeBuff]);
    const state = createTeamState({
      actors: [inputActor],
      activeActorId: inputActor.actorId,
      target: { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 },
    });
    const result = applyTeamStructuredTrigger({
      state,
      event: event(inputActor.actorId),
      ownerActorId: inputActor.actorId,
      sourceDefinition: sourceEffect,
      ownerDefinitions: [sourceEffect, activeBuff],
      trigger,
      sequence: 0,
      panelStats: stats,
      resonanceMode: "fixture-mode",
      element: "spectro",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.state.actorsById[inputActor.actorId]!.resources.gauge.current).toBe(3);
    expect(result.state.actorsById[inputActor.actorId]!.states).toContain("powered");
    expect(result.state.actorsById[inputActor.actorId]!.currentForm).toBe("empowered");
    expect(result.state.activeEffects.find((effect) => effect.definition.id === "runtime-buff")?.stacks).toBe(2);
    expect(result.state.targetsById.target.statuses[`mark::${inputActor.actorId}`]?.stacks).toBe(1);
    expect(Object.keys(result.state.cooldowns)).toContain(
      "action-target:starter:target:source-effect:team-owner:slot-any-name:universal-ops",
    );
    expect(result.emittedEvents.map((entry) => [entry.kind, entry.timestamp, entry.actionId])).toEqual([
      ["custom", 0.25, "starter"],
      ["action-hit", 0.5, "derived-hit"],
    ]);
  });

  it("keeps target statuses owner-scoped across two actor instances", () => {
    const first = actor("first-instance", [sourceEffect, activeBuff]);
    const second = actor("second-instance", [sourceEffect, activeBuff]);
    let state = createTeamState({
      actors: [first, second],
      activeActorId: first.actorId,
      target: { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 },
    });
    for (const inputActor of [first, second]) {
      const applied = applyTeamStructuredTrigger({
        state,
        event: event(inputActor.actorId),
        ownerActorId: inputActor.actorId,
        sourceDefinition: sourceEffect,
        ownerDefinitions: [sourceEffect, activeBuff],
        trigger: { ...trigger, operations: [{ kind: "apply-status", statusId: "mark", stacks: { kind: "constant", value: 1 } }] },
        sequence: 0,
        panelStats: stats,
        element: "spectro",
      });
      expect(applied.diagnostics).toEqual([]);
      state = applied.state;
    }
    expect(state.targetsById.target.statuses["mark::first-instance"]?.sourceOwnerId).toBe("first-instance");
    expect(state.targetsById.target.statuses["mark::second-instance"]?.sourceOwnerId).toBe("second-instance");
    expect(Object.keys(state.cooldowns)).toEqual(
      expect.arrayContaining([
        "action-target:starter:target:source-effect:team-owner:first-instance:universal-ops",
        "action-target:starter:target:source-effect:team-owner:second-instance:universal-ops",
      ]),
    );
  });

  it("uses State Engine expiry semantics for effects and statuses", () => {
    const inputActor = actor("expiry-slot", [sourceEffect, activeBuff]);
    const initial = createTeamState({
      actors: [inputActor],
      activeActorId: inputActor.actorId,
      target: { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 },
    });
    const applied = applyTeamStructuredTrigger({
      state: initial,
      event: event(inputActor.actorId),
      ownerActorId: inputActor.actorId,
      sourceDefinition: sourceEffect,
      ownerDefinitions: [sourceEffect, activeBuff],
      trigger: { ...trigger, operations: [
        { kind: "activate-effect", effectId: "runtime-buff" },
        { kind: "apply-status", statusId: "mark", stacks: { kind: "constant", value: 1 } },
      ] },
      sequence: 0,
      panelStats: stats,
      element: "spectro",
    });
    const afterOne = advanceTeamRuntime(applied.state, 1);
    expect(afterOne.state.targetsById.target.statuses).toEqual({});
    expect(afterOne.state.activeEffects.some((effect) => effect.definition.id === "runtime-buff")).toBe(true);
    const afterTwo = advanceTeamRuntime(afterOne.state, 2);
    expect(afterTwo.state.activeEffects.some((effect) => effect.definition.id === "runtime-buff")).toBe(false);
  });
});
