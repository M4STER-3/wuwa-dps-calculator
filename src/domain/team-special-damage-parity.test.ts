import { describe, expect, it } from "vitest";

import type { CombatAction, Resonator, UserBuild } from "./models";
import { simulateTeam, type TeamActorInput } from "./team-engine";

const source = {
  kind: "technical-fixture" as const,
  source: "Team special damage parity fixture",
};

const tuneAction: CombatAction = {
  id: "fixture-tune-rupture",
  name: "Fixture Tune Rupture",
  talent: "forteCircuit",
  damageType: "tuneRupture",
  scaling: "tuneAmp",
  level: 10,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 1, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0.5], confidence: "technical-fixture" },
  source,
};

const fusionAction: CombatAction = {
  id: "fixture-fusion-burst",
  name: "Fixture Fusion Burst",
  talent: "forteCircuit",
  level: 10,
  multipliers: [],
  castDurationSeconds: { value: 0, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [], confidence: "technical-fixture" },
  source,
};

const resonator: Resonator = {
  id: "special-damage-resonator",
  name: "Special Damage Resonator",
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
    actions: [tuneAction, fusionAction],
    effects: [],
    rotations: [],
    unknowns: [],
    source,
  },
  source,
};

const build: UserBuild = {
  id: "special-damage-build",
  resonatorId: resonator.id,
  sourcePresetId: "special-damage-preset",
  characterLevel: 90,
  sequence: 0,
  skillLevels: {
    basicAttack: 10,
    resonanceSkill: 10,
    forteCircuit: 10,
    resonanceLiberation: 10,
    introSkill: 10,
  },
  weapon: { weaponId: "special-damage-weapon", level: 90, rank: 1 },
  finalStats: {
    hp: 10000,
    attack: 1000,
    defense: 1000,
    critRate: 5,
    critDamage: 150,
    energyRegen: 100,
    healingBonus: 0,
    tuneBreakBoost: 10,
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
  createdAt: "2026-08-21T18:40:00.000Z",
  updatedAt: "2026-08-21T18:40:00.000Z",
};

const actor: TeamActorInput = {
  actorId: "p1",
  resonator,
  build,
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
  tuneEnemyClass: "4C" as const,
};

describe("Team special damage parity with Personal", () => {
  it("calculates Tune Rupture actions with the canonical Tune formula", () => {
    const result = simulateTeam({
      actors: [actor],
      activeActorId: actor.actorId,
      target,
      steps: [
        {
          kind: "action",
          actorId: actor.actorId,
          actionId: tuneAction.id,
          durationOverrideSeconds: 1,
        },
      ],
    });

    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]!.damage.formula).toBe("tune-rupture-v0.2");
    expect(result.totalResolvedDamage.expected).toBeGreaterThan(0);
  });

  it("calculates Fusion Burst scenario events instead of treating them as trigger-only", () => {
    const result = simulateTeam({
      actors: [actor],
      activeActorId: actor.actorId,
      target,
      externalEvents: [
        {
          id: "scenario:fixture:fusion:0",
          timestamp: 0.5,
          kind: "fusion-burst",
          ownerId: actor.actorId,
          actorId: actor.actorId,
          targetId: "target",
          actionId: fusionAction.id,
          external: true,
          payload: { scenarioId: "fixture", stacks: 10 },
        },
      ],
      steps: [{ kind: "wait", seconds: 1 }],
    });

    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]!.damage.formula).toBe("negative-status-v0.2");
    expect(result.totalResolvedDamage.expected).toBeGreaterThan(0);
  });

  it("includes exact fixed scenario damage without requiring a synthetic action", () => {
    const amount = 61803;
    const result = simulateTeam({
      actors: [actor],
      activeActorId: actor.actorId,
      target,
      externalEvents: [
        {
          id: "scenario:fixture:fixed:0",
          timestamp: 0.5,
          kind: "custom",
          ownerId: actor.actorId,
          actorId: actor.actorId,
          targetId: "target",
          actionId: "fixture-fixed-damage",
          external: true,
          payload: {
            scenarioId: "fixture",
            fixedDamageAmount: amount,
            fixedDamageType: "basicAttack",
          },
        },
      ],
      steps: [{ kind: "wait", seconds: 1 }],
    });

    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]!.damage.formula).toBe("fixed-scenario-damage");
    expect(result.totalResolvedDamage.expected).toBe(amount);
  });
});
