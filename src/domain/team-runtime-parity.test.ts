import { describe, expect, it } from "vitest";

import type { EffectDefinition } from "./effect-models";
import type {
  CombatAction,
  FinalStats,
  Resonator,
  UserBuild,
  Weapon,
} from "./models";
import {
  createTeamState,
  simulateTeam,
  type TeamActorInput,
} from "./team-engine";
import { buildTeamActorInputs } from "./team-rotation-builder";

const source = { kind: "technical-fixture" as const, source: "team runtime parity test" };

const stats = (overrides: Partial<FinalStats> = {}): FinalStats => ({
  hp: 1000,
  attack: 100,
  defense: 200,
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
  ...overrides,
});

const action = (
  id: string,
  scalingAttribute: CombatAction["scalingAttribute"] = "attack",
): CombatAction => ({
  id,
  name: id,
  talent: "basicAttack",
  damageType: "basicAttack",
  scalingAttribute,
  level: 1,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 0, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0], confidence: "technical-fixture" },
  source,
});

function resonator(actions: readonly CombatAction[] = [action("hit")]): Resonator {
  return {
    id: "runtime-resonator",
    name: "Runtime Resonator",
    element: "spectro",
    weaponType: "rectifier",
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
      forms: ["base", "alternate"],
      defaultForm: "base",
      modes: ["mode-a", "mode-b"],
      resources: [
        {
          id: "meter",
          name: "Meter",
          cap: 10,
          semantic: "character-resource",
          notes: [],
        },
      ],
      actions,
      effects: [],
      rotations: [],
      unknowns: [],
      source,
    },
    source,
  };
}

function build(
  sequence: UserBuild["sequence"] = 0,
  rank = 1,
  finalStats = stats(),
): UserBuild {
  return {
    id: `build-s${sequence}-r${rank}`,
    resonatorId: "runtime-resonator",
    sourcePresetId: "fixture",
    characterLevel: 90,
    sequence,
    skillLevels: {
      basicAttack: 1,
      resonanceSkill: 1,
      forteCircuit: 1,
      resonanceLiberation: 1,
      introSkill: 1,
    },
    weapon: { weaponId: "runtime-weapon", level: 90, rank },
    finalStats,
    createdAt: "",
    updatedAt: "",
  };
}

const target = {
  level: 90,
  elementalResistance: { spectro: 0 },
  physicalResistance: 0,
};

function actor(options: {
  sequence?: UserBuild["sequence"];
  rank?: number;
  finalStats?: FinalStats;
  actions?: readonly CombatAction[];
  effects?: readonly EffectDefinition[];
  weapon?: Weapon;
  resonanceMode?: string;
  initialResources?: Readonly<Record<string, number>>;
} = {}): TeamActorInput {
  return {
    actorId: "slot-any",
    resonator: resonator(options.actions),
    build: build(options.sequence, options.rank, options.finalStats),
    effects: options.effects,
    weapon: options.weapon,
    resonanceMode: options.resonanceMode,
    initialResources: options.initialResources,
  };
}

function initiallyActiveRuntimeEffect(
  id: string,
  modifiers: EffectDefinition["rules"][number]["modifiers"],
  predicates: EffectDefinition["rules"][number]["predicates"] = [],
): EffectDefinition {
  return {
    id,
    label: id,
    source: { id, type: "system", label: id },
    target: "self",
    activationPolicy: "initially-active",
    rules: [
      {
        id: `${id}-rule`,
        label: id,
        accounting: "runtime",
        predicates,
        modifiers,
      },
    ],
  };
}

describe("Team runtime parity with Personal DPS", () => {
  it("shares ground and exact sequence states with the Personal runtime", () => {
    const state = createTeamState({
      actors: [actor({ sequence: 3 })],
      activeActorId: "slot-any",
      target,
    });

    expect(state.actorsById["slot-any"].states).toEqual([
      "ground",
      "sequence-3",
      "sequence-at-least-1",
      "sequence-at-least-2",
      "sequence-at-least-3",
    ]);
    expect(state.actorsById["slot-any"].states).not.toContain(
      "sequence-at-least-4",
    );
  });

  it("uses the action-owned HP/DEF/ATK scaling attribute instead of forcing ATK", () => {
    const attackAction = action("attack-hit", "attack");
    const hpAction = action("hp-hit", "hp");
    const result = simulateTeam({
      actors: [actor({ actions: [attackAction, hpAction] })],
      activeActorId: "slot-any",
      target,
      steps: [
        { kind: "action", actorId: "slot-any", actionId: attackAction.id },
        { kind: "action", actorId: "slot-any", actionId: hpAction.id },
      ],
    });

    const attackDamage = result.damageEvents.find(
      (event) => event.actionId === attackAction.id,
    )?.damage;
    const hpDamage = result.damageEvents.find(
      (event) => event.actionId === hpAction.id,
    )?.damage;

    expect(attackDamage?.status).toBe("supported");
    expect(hpDamage?.status).toBe("supported");
    if (attackDamage?.status === "supported" && hpDamage?.status === "supported") {
      expect(hpDamage.total.nonCrit).toBeCloseTo(attackDamage.total.nonCrit * 10);
    }
  });

  it("materializes weapon rank expressions before Team runtime evaluation without mutating finalStats", () => {
    const rankedEffect: EffectDefinition = {
      id: "ranked-weapon-effect",
      label: "Ranked weapon effect",
      source: { id: "runtime-weapon", type: "weapon", label: "Runtime Weapon" },
      target: "self",
      activationPolicy: "initially-active",
      rules: [
        {
          id: "ranked-flat-attack",
          label: "Ranked flat attack",
          accounting: "runtime",
          modifiers: [
            {
              kind: "runtime-stat",
              stat: "attack",
              mode: "flat",
              stacking: "additive",
              value: {
                kind: "rank",
                values: { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 },
              },
            },
          ],
        },
      ],
    };
    const weapon: Weapon = {
      id: "runtime-weapon",
      name: "Runtime Weapon",
      type: "rectifier",
      rarity: 5,
      effects: [
        {
          id: "ranked-legacy-wrapper",
          name: "Ranked wrapper",
          sourceId: "runtime-weapon",
          trigger: "initial",
          target: "self",
          effect: "ranked",
          source,
          structuredEffect: rankedEffect,
        },
      ],
      source,
    };
    const panel = stats({ attack: 100 });

    const r1 = simulateTeam({
      actors: [actor({ rank: 1, finalStats: panel, weapon })],
      activeActorId: "slot-any",
      target,
      steps: [{ kind: "action", actorId: "slot-any", actionId: "hit" }],
    });
    const r5 = simulateTeam({
      actors: [actor({ rank: 5, finalStats: panel, weapon })],
      activeActorId: "slot-any",
      target,
      steps: [{ kind: "action", actorId: "slot-any", actionId: "hit" }],
    });

    expect(r1.damageEvents[0]?.scalingStats.attack).toBe(110);
    expect(r5.damageEvents[0]?.scalingStats.attack).toBe(150);
    expect(panel.attack).toBe(100);
    expect(r5.actorsById["slot-any"].finalStats.attack).toBe(100);
  });

  it("provides mode, form, sequence state, resource, event and ownership context to runtime predicates", () => {
    const contextEffect = initiallyActiveRuntimeEffect(
      "context-gate",
      [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "flat",
          stacking: "additive",
          value: { kind: "constant", value: 100 },
        },
      ],
      [
        { kind: "identity", field: "actorId", anyOf: ["slot-any"] },
        { kind: "identity", field: "ownerId", anyOf: ["slot-any"] },
        { kind: "identity", field: "damageOwnerId", anyOf: ["slot-any"] },
        { kind: "identity", field: "actionId", anyOf: ["hit"] },
        { kind: "identity", field: "resonanceMode", anyOf: ["mode-b"] },
        { kind: "identity", field: "form", anyOf: ["base"] },
        { kind: "identity", field: "eventKind", anyOf: ["action-start"] },
        { kind: "identity", field: "eventTargetId", anyOf: ["target"] },
        { kind: "state-active", id: "sequence-at-least-3" },
        { kind: "resource", resourceId: "meter", comparison: "available" },
        { kind: "has-effect", id: "context-gate" },
        { kind: "on-field", value: true },
      ],
    );

    const matched = simulateTeam({
      actors: [
        actor({
          sequence: 3,
          resonanceMode: "mode-b",
          initialResources: { meter: 1 },
          effects: [contextEffect],
        }),
      ],
      activeActorId: "slot-any",
      target,
      steps: [{ kind: "action", actorId: "slot-any", actionId: "hit" }],
    });
    const wrongMode = simulateTeam({
      actors: [
        actor({
          sequence: 3,
          resonanceMode: "mode-a",
          initialResources: { meter: 1 },
          effects: [contextEffect],
        }),
      ],
      activeActorId: "slot-any",
      target,
      steps: [{ kind: "action", actorId: "slot-any", actionId: "hit" }],
    });

    expect(matched.damageEvents[0]?.scalingStats.attack).toBe(200);
    expect(wrongMode.damageEvents[0]?.scalingStats.attack).toBe(100);
    expect(matched.diagnostics).toEqual([]);
  });

  it("threads the selected build mode into the Team actor input with a deterministic default", () => {
    const fixtureResonator = resonator();
    const fixtureWeapon: Weapon = {
      id: "runtime-weapon",
      name: "Runtime Weapon",
      type: "rectifier",
      rarity: 5,
      source,
    };
    const fixtureBuild = build();
    const catalog = {
      resonators: [fixtureResonator],
      weapons: [fixtureWeapon],
      sonatas: [],
      mainEchoes: [],
    };

    const selected = buildTeamActorInputs(
      [fixtureBuild],
      catalog,
      {},
      { [fixtureBuild.id]: "slot-any" },
      { [fixtureBuild.id]: "mode-b" },
    );
    const fallback = buildTeamActorInputs(
      [fixtureBuild],
      catalog,
      {},
      { [fixtureBuild.id]: "slot-any" },
    );

    expect(selected.diagnostics).toEqual([]);
    expect(selected.actors[0]?.resonanceMode).toBe("mode-b");
    expect(fallback.actors[0]?.resonanceMode).toBe("mode-a");
  });
});
