import { describe, expect, it } from "vitest";

import type { CoordinatedResponseDefinition } from "./coordinated-response-engine";
import type { EffectDefinition } from "./effect-models";
import type {
  CombatAction,
  FinalStats,
  Resonator,
  UserBuild,
} from "./models";
import { simulateTeam } from "./team-engine";

const source = { kind: "technical-fixture" as const, source: "team per-hit test" };
const target = {
  level: 90,
  elementalResistance: { spectro: 0 },
  physicalResistance: 0,
};

function stats(attack = 100): FinalStats {
  return {
    hp: 1000,
    attack,
    defense: 100,
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
  };
}

function multiHitAction(
  id = "multi",
  timings: readonly number[] | null = [0.25, 0.75],
): CombatAction {
  return {
    id,
    name: id,
    talent: "basicAttack",
    damageType: "basicAttack",
    level: 1,
    multipliers: [{ percent: 100, hits: 2 }],
    castDurationSeconds: { value: 1, confidence: "technical-fixture" },
    recoverySeconds: { value: 0, confidence: "technical-fixture" },
    hitTimingsSeconds: {
      value: timings,
      confidence: timings === null ? "unknown" : "technical-fixture",
    },
    source,
  };
}

function actor(
  actorId: string,
  action: CombatAction,
  options: {
    attack?: number;
    effects?: readonly EffectDefinition[];
    coordinatedResponses?: readonly CoordinatedResponseDefinition[];
  } = {},
) {
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
      forms: [],
      modes: [],
      resources: [],
      actions: [action],
      effects: [],
      coordinatedResponses: options.coordinatedResponses,
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
    finalStats: stats(options.attack),
    createdAt: "",
    updatedAt: "",
  };
  return {
    actorId,
    resonator,
    build,
    effects: options.effects,
    coordinatedResponses: options.coordinatedResponses,
  };
}

function runSingle(
  inputActor: ReturnType<typeof actor>,
  actionId = "multi",
) {
  return simulateTeam({
    actors: [inputActor],
    activeActorId: inputActor.actorId,
    target,
    steps: [
      {
        kind: "action",
        actorId: inputActor.actorId,
        actionId,
      },
    ],
  });
}

describe("Team per-hit global timeline", () => {
  it("executes one damage snapshot per exact hit at global timestamps", () => {
    const exact = runSingle(actor("slot-x", multiHitAction()));
    expect(exact.damageEvents.map((event) => event.timestamp)).toEqual([0.25, 0.75]);
    expect(exact.eventLog.filter((event) => event.kind === "action-hit")).toHaveLength(2);
    expect(exact.eventLog.filter((event) => event.kind === "damage-dealt")).toHaveLength(2);

    const aggregate = runSingle(actor("slot-x", multiHitAction("multi", null)));
    expect(aggregate.damageEvents).toHaveLength(1);
    expect(exact.totalResolvedDamage.expected).toBeCloseTo(
      aggregate.totalResolvedDamage.expected,
    );
  });

  it("recomputes runtime state between hits so first-hit damage can buff the second hit", () => {
    const buff: EffectDefinition = {
      id: "after-first-hit-buff",
      label: "After first hit",
      source: { id: "fixture", type: "system", label: "Fixture" },
      target: "self",
      activationPolicy: "triggered",
      lifecycle: {
        duration: { kind: "fixed", seconds: 5 },
        refresh: "reset-duration",
        uniqueness: "refresh-existing",
      },
      rules: [
        {
          id: "runtime-attack",
          label: "Runtime attack",
          accounting: "runtime",
          modifiers: [
            {
              kind: "runtime-stat",
              stat: "attack",
              mode: "flat",
              stacking: "additive",
              value: { kind: "constant", value: 100 },
            },
          ],
        },
      ],
      triggers: [
        {
          id: "activate-after-damage",
          event: "damage-dealt",
          operations: [
            { kind: "activate-effect", effectId: "after-first-hit-buff" },
          ],
        },
      ],
    };
    const result = runSingle(
      actor("arbitrary-slot", multiHitAction(), { effects: [buff] }),
    );
    expect(result.damageEvents).toHaveLength(2);
    expect(result.damageEvents[0]!.scalingStats.attack).toBe(100);
    expect(result.damageEvents[1]!.scalingStats.attack).toBe(200);
    expect(result.damageEvents[1]!.damage.status).toBe("supported");
    expect(result.damageEvents[0]!.damage.status).toBe("supported");
    if (
      result.damageEvents[0]!.damage.status === "supported" &&
      result.damageEvents[1]!.damage.status === "supported"
    ) {
      expect(result.damageEvents[1]!.damage.total.expected).toBeGreaterThan(
        result.damageEvents[0]!.damage.total.expected,
      );
    }
  });

  it("routes action-hit triggers once per real hit", () => {
    const hitCounter: EffectDefinition = {
      id: "hit-counter",
      label: "Hit counter",
      source: { id: "fixture", type: "system", label: "Fixture" },
      target: "enemy",
      activationPolicy: "triggered",
      rules: [],
      statuses: [
        { id: "hit-mark", label: "Hit mark", maxStacks: 10 },
      ],
      triggers: [
        {
          id: "mark-each-hit",
          event: "action-hit",
          operations: [
            {
              kind: "apply-status",
              statusId: "hit-mark",
              stacks: { kind: "constant", value: 1 },
            },
          ],
        },
      ],
    };
    const result = runSingle(
      actor("slot-with-any-id", multiHitAction(), { effects: [hitCounter] }),
    );
    const status = Object.values(result.targetsById.target.statuses).find(
      (candidate) => candidate.definition.id === "hit-mark",
    );
    expect(status?.stacks).toBe(2);
  });

  it("applies grouped Motion Value modifiers before selecting each hit", () => {
    const mv: EffectDefinition = {
      id: "distributed-mv",
      label: "Distributed MV",
      source: { id: "fixture", type: "system", label: "Fixture" },
      target: "self",
      activationPolicy: "initially-active",
      rules: [
        {
          id: "mv-rule",
          label: "MV rule",
          accounting: "runtime",
          modifiers: [
            {
              kind: "motion-value",
              mode: "additive-percent",
              stacking: "additive",
              value: { kind: "constant", value: 100 },
              groupDistribution: [{ groupIndex: 0, weight: 1 }],
            },
          ],
        },
      ],
    };
    const action: CombatAction = {
      ...multiHitAction(),
      multipliers: [{ percent: 100, hits: 2 }],
    };
    const result = runSingle(actor("slot-mv", action, { effects: [mv] }));
    expect(result.damageEvents).toHaveLength(2);
    if (result.damageEvents.every((event) => event.damage.status === "supported")) {
      const totalMotionValue = result.damageEvents.reduce(
        (total, event) =>
          total + (event.damage.status === "supported" ? event.damage.totalMotionValue : 0),
        0,
      );
      expect(totalMotionValue).toBeCloseTo(3);
    }
  });

  it("does not duplicate one-per-action healing outcomes across hits", () => {
    const healingAction: CombatAction = {
      ...multiHitAction("healing-multi"),
      outcomes: {
        target: "self",
        healingByTalentLevel: {
          1: { scalingAttribute: "hp", percent: 10, flat: 0 },
        },
      },
    };
    const result = runSingle(actor("slot-heal", healingAction), "healing-multi");
    expect(result.damageEvents).toHaveLength(2);
    expect(result.healingEvents).toHaveLength(1);
  });
});
