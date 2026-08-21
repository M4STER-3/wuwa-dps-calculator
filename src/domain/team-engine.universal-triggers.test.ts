import { describe, expect, it } from "vitest";

import type { EffectDefinition } from "./effect-models";
import type { CombatAction, FinalStats, Resonator, UserBuild } from "./models";
import { simulateTeam } from "./team-engine";

const source = { kind: "technical-fixture" as const, source: "team universal trigger test" };
const target = { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 };
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

function action(id: string, hitAt: number): CombatAction {
  return {
    id,
    name: id,
    talent: "basicAttack",
    damageType: "basicAttack",
    level: 1,
    multipliers: [{ percent: 100, hits: 1 }],
    castDurationSeconds: { value: 0.5, confidence: "technical-fixture" },
    recoverySeconds: { value: 0, confidence: "technical-fixture" },
    hitTimingsSeconds: { value: [hitAt], confidence: "technical-fixture" },
    source,
  };
}

const starter = action("starter", 0.2);
const derived = action("derived-hit", 0);

const runtimeBuff: EffectDefinition = {
  id: "runtime-buff",
  label: "Runtime buff",
  source: { id: "fixture", type: "system", label: "Fixture" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 5 },
    stacks: { kind: "shared", max: 5, initial: 0 },
  },
  rules: [],
};

const sourceEffect: EffectDefinition = {
  id: "universal-source",
  label: "Universal source",
  source: { id: "fixture", type: "system", label: "Fixture" },
  target: "self",
  activationPolicy: "triggered",
  rules: [],
  statuses: [{ id: "mark", label: "Mark", maxStacks: 3, durationSeconds: 2 }],
  triggers: [
    {
      id: "starter-trigger",
      event: "action-start",
      maxTriggers: 1,
      operations: [
        { kind: "activate-effect", effectId: "runtime-buff" },
        { kind: "gain-stacks", effectId: "runtime-buff", amount: { kind: "constant", value: 2 } },
        { kind: "resource", operation: "gain", resourceId: "gauge", amount: { kind: "constant", value: 3 } },
        { kind: "enter-state", stateId: "powered" },
        { kind: "change-form", stateId: "empowered" },
        { kind: "apply-status", statusId: "mark", stacks: { kind: "constant", value: 1 } },
        {
          kind: "emit-action",
          action: {
            actionId: "derived-hit",
            delaySeconds: 0.1,
            attribution: "follow-up",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
      ],
    },
  ],
};

function fixtureActor(actorId = "arbitrary-slot") {
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
      resources: [{ id: "gauge", name: "Gauge", cap: 10, semantic: "character-resource", source }],
      actions: [starter, derived],
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
  return { actorId, resonator, build, effects: [sourceEffect, runtimeBuff] };
}

describe("Team universal structured triggers", () => {
  it("executes formerly unsupported operations and emitted damage on the global timeline", () => {
    const inputActor = fixtureActor();
    const result = simulateTeam({
      actors: [inputActor],
      activeActorId: inputActor.actorId,
      target,
      steps: [{ kind: "action", actorId: inputActor.actorId, actionId: "starter" }],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.actorsById[inputActor.actorId]!.resources.gauge.current).toBe(3);
    expect(result.actorsById[inputActor.actorId]!.states).toContain("powered");
    expect(result.actorsById[inputActor.actorId]!.currentForm).toBe("empowered");
    expect(result.activeEffects.find((effect) => effect.definition.id === "runtime-buff")?.stacks).toBe(2);
    expect(result.targetsById.target.statuses[`mark::${inputActor.actorId}`]?.stacks).toBe(1);
    expect(result.damageEvents.map((event) => [event.actionId, event.timestamp])).toEqual([
      ["derived-hit", 0.1],
      ["starter", 0.2],
    ]);
    expect(result.totalResolvedDamage.expected).toBeGreaterThan(0);
  });

  it("preserves State Engine trigger counters across successive Team actions", () => {
    const inputActor = fixtureActor("counter-slot");
    const result = simulateTeam({
      actors: [inputActor],
      activeActorId: inputActor.actorId,
      target,
      steps: [
        { kind: "action", actorId: inputActor.actorId, actionId: "starter" },
        { kind: "action", actorId: inputActor.actorId, actionId: "starter" },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.actorsById[inputActor.actorId]!.resources.gauge.current).toBe(3);
    expect(result.damageEvents.filter((event) => event.actionId === "derived-hit")).toHaveLength(1);
    expect(result.damageEvents.filter((event) => event.actionId === "starter")).toHaveLength(2);
  });
});
