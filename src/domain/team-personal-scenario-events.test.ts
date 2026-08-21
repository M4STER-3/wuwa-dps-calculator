import { describe, expect, it } from "vitest";

import type { EffectDefinition } from "./effect-models";
import type { CombatAction, Resonator, UserBuild } from "./models";
import { simulateTeam, type TeamActorInput } from "./team-engine";

const source = {
  kind: "technical-fixture" as const,
  source: "Team Personal scenario-event compatibility fixture",
};

const action: CombatAction = {
  id: "scenario-event-hit",
  name: "Scenario Event Hit",
  talent: "basicAttack",
  damageType: "basicAttack",
  level: 10,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 1, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0.5], confidence: "technical-fixture" },
  source,
};

const scenarioEffect: EffectDefinition = {
  id: "scenario-event-buff",
  label: "Scenario event buff",
  source: {
    id: "scenario-event-source",
    type: "system",
    label: "Scenario event source",
  },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 5 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "scenario-event-double-damage",
      label: "+100% All DMG",
      accounting: "runtime",
      modifiers: [
        { kind: "all-damage-bonus", stacking: "additive", value: 100 },
      ],
    },
  ],
  triggers: [
    {
      id: "scenario-event-activation",
      event: "fusion-burst",
      operations: [{ kind: "activate-effect", effectId: "scenario-event-buff" }],
    },
  ],
};

const resonator: Resonator = {
  id: "scenario-event-resonator",
  name: "Scenario Event Resonator",
  element: "fusion",
  weaponType: "sword",
  rarity: 5,
  skillNames: {
    basicAttack: "Basic",
    resonanceSkill: "Skill",
    forteCircuit: "Forte",
    resonanceLiberation: "Liberation",
    introSkill: "Intro",
  },
  resonanceChain: [],
  combat: {
    level10Only: false,
    forms: ["Default"],
    defaultForm: "Default",
    modes: [],
    resources: [],
    actions: [action],
    effects: [],
    rotations: [],
    unknowns: [],
    source,
  },
  source,
};

const build: UserBuild = {
  id: "scenario-event-build",
  resonatorId: resonator.id,
  sourcePresetId: "scenario-event-preset",
  characterLevel: 90,
  sequence: 0,
  skillLevels: {
    basicAttack: 10,
    resonanceSkill: 10,
    forteCircuit: 10,
    resonanceLiberation: 10,
    introSkill: 10,
  },
  weapon: { weaponId: "scenario-event-weapon", level: 90, rank: 1 },
  finalStats: {
    hp: 10000,
    attack: 1000,
    defense: 1000,
    critRate: 0,
    critDamage: 150,
    energyRegen: 100,
    healingBonus: 0,
    tuneBreakBoost: 0,
    elementalDamageBonus: {
      aero: 0,
      glacio: 0,
      electro: 0,
      fusion: 0,
      havoc: 0,
      spectro: 0,
    },
    damageTypeBonus: {
      basicAttack: 0,
      heavyAttack: 0,
      resonanceSkill: 0,
      resonanceLiberation: 0,
      introSkill: 0,
      echoSkill: 0,
    },
  },
  createdAt: "2026-08-21T18:30:00.000Z",
  updatedAt: "2026-08-21T18:30:00.000Z",
};

const actor: TeamActorInput = {
  actorId: "p1",
  resonator,
  build,
  effects: [scenarioEffect],
};

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

function run(withScenarioEvent: boolean) {
  return simulateTeam({
    actors: [actor],
    activeActorId: actor.actorId,
    target,
    externalEvents: withScenarioEvent
      ? [
          {
            id: "scenario:fusion-burst:0",
            timestamp: 0,
            kind: "fusion-burst",
            ownerId: actor.actorId,
            actorId: actor.actorId,
            targetId: "target",
            external: true,
          },
        ]
      : [],
    steps: [
      {
        kind: "action",
        actorId: actor.actorId,
        actionId: action.id,
        durationOverrideSeconds: 1,
      },
    ],
  });
}

describe("Team Personal scenario event routing", () => {
  it("routes arbitrary external scenario event kinds through structured triggers", () => {
    const baseline = run(false);
    const triggered = run(true);

    expect(baseline.totalResolvedDamage.expected).toBeGreaterThan(0);
    expect(triggered.totalResolvedDamage.expected).toBeGreaterThan(
      baseline.totalResolvedDamage.expected,
    );
    expect(
      triggered.activeEffects.some(
        (effect) => effect.definition.id === scenarioEffect.id,
      ),
    ).toBe(true);
  });
});
