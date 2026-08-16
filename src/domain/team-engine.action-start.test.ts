import { describe, expect, it } from "vitest";
import type { EffectDefinition } from "./effect-models";
import type { CombatAction, FinalStats, Resonator, Sequence, UserBuild } from "./models";
import { simulateTeam, type TeamActorInput } from "./team-engine";

const source = { kind: "technical-fixture" as const, source: "team action-start regression" };
const target = { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 };

const stats = (attack = 100): FinalStats => ({
  hp: 1000,
  attack,
  defense: 100,
  critRate: 0,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
});

const action = (id: string, talent: CombatAction["talent"] = "basicAttack"): CombatAction => ({
  id,
  name: id,
  talent,
  damageType: talent === "introSkill" ? "introSkill" : "basicAttack",
  level: 1,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 0, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0], confidence: "technical-fixture" },
  source,
});

function actor(
  actorId: string,
  sequence: Sequence = 0,
  actions: readonly CombatAction[] = [action("hit")],
  effects: readonly EffectDefinition[] = [],
  concerto = 0,
): TeamActorInput {
  const resonatorId = `res-${actorId}`;
  const resonator: Resonator = {
    id: resonatorId,
    name: resonatorId,
    element: "spectro",
    weaponType: "rectifier",
    rarity: 5,
    skillNames: { basicAttack: "", resonanceSkill: "", forteCircuit: "", resonanceLiberation: "", introSkill: "" },
    resonanceChain: [],
    combat: {
      level10Only: false,
      forms: [],
      modes: [],
      resources: [{ id: "concerto", name: "Concerto", cap: 100, semantic: "concerto-energy", notes: [] }],
      actions,
      effects: [],
      rotations: [],
      unknowns: [],
      source,
    },
    source,
  };
  const build: UserBuild = {
    id: `build-${actorId}`,
    resonatorId,
    sourcePresetId: "fixture",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 1, resonanceSkill: 1, forteCircuit: 1, resonanceLiberation: 1, introSkill: 1 },
    weapon: { weaponId: "fixture", level: 90, rank: 1 },
    finalStats: stats(),
    createdAt: "",
    updatedAt: "",
  };
  return { actorId, resonator, build, effects, initialResources: { concerto } };
}

const triggeredBuff = (triggerActionId: string, expireActionId?: string): EffectDefinition => ({
  id: "action-start-buff",
  label: "Action-start buff",
  source: { id: "fixture", type: "system", label: "Fixture" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 10 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "buff-damage",
    label: "Damage bonus",
    accounting: "runtime",
    modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 100 }],
  }],
  triggers: [
    {
      id: "activate-on-start",
      event: "action-start",
      predicates: [{ kind: "identity", field: "actionId", anyOf: [triggerActionId] }],
      operations: [{ kind: "activate-effect", effectId: "action-start-buff" }],
    },
    ...(expireActionId ? [{
      id: "expire-on-start",
      event: "action-start" as const,
      predicates: [{ kind: "identity" as const, field: "actionId" as const, anyOf: [expireActionId] }],
      operations: [{ kind: "expire-effect" as const, effectId: "action-start-buff" }],
    }] : []),
  ],
});

describe("Team Engine structured action-start regressions", () => {
  it("activates a structured action-start effect before the same direct action resolves damage, and can expire it later", () => {
    const buffHit = action("buff-hit");
    const clearHit = action("clear-hit");
    const baselineActor = actor("baseline", 0, [buffHit]);
    const baseline = simulateTeam({ actors: [baselineActor], activeActorId: "baseline", target, steps: [{ kind: "action", actorId: "baseline", actionId: "buff-hit" }] });

    const buffedActor = actor("buffed", 0, [buffHit, clearHit], [triggeredBuff("buff-hit", "clear-hit")]);
    const buffed = simulateTeam({ actors: [buffedActor], activeActorId: "buffed", target, steps: [{ kind: "action", actorId: "buffed", actionId: "buff-hit" }] });
    expect(buffed.activeEffects.some(effect => effect.definition.id === "action-start-buff")).toBe(true);
    expect(buffed.damageEvents[0].damage.status).toBe("supported");
    expect(baseline.damageEvents[0].damage.status).toBe("supported");
    if (buffed.damageEvents[0].damage.status === "supported" && baseline.damageEvents[0].damage.status === "supported") {
      expect(buffed.damageEvents[0].damage.total.expected).toBeGreaterThan(baseline.damageEvents[0].damage.total.expected);
    }

    const cleared = simulateTeam({ actors: [buffedActor], activeActorId: "buffed", target, steps: [
      { kind: "action", actorId: "buffed", actionId: "buff-hit" },
      { kind: "action", actorId: "buffed", actionId: "clear-hit" },
    ] });
    expect(cleared.activeEffects.some(effect => effect.definition.id === "action-start-buff")).toBe(false);
    expect(cleared.stateTransitions.some(transition => transition.kind === "effect-expired" && transition.detail === "action-start-buff")).toBe(true);
  });

  it("dispatches action-start for a derived Intro so Intro-triggered effects activate before Intro damage", () => {
    const outgoing = actor("outgoing", 0, [action("outgoing-hit")], [], 100);
    const intro = action("incoming-intro", "introSkill");
    const incoming = actor("incoming", 0, [intro], [triggeredBuff("incoming-intro")]);
    const result = simulateTeam({ actors: [outgoing, incoming], activeActorId: "outgoing", target, steps: [{ kind: "switch", toActorId: "incoming" }] });
    const introIndex = result.eventLog.findIndex(event => event.kind === "intro");
    const actionStartIndex = result.eventLog.findIndex(event => event.kind === "action-start" && event.actorId === "incoming");
    expect(introIndex).toBeGreaterThanOrEqual(0);
    expect(actionStartIndex).toBeGreaterThan(introIndex);
    expect(result.activeEffects.some(effect => effect.definition.id === "action-start-buff" && effect.ownerId === "incoming")).toBe(true);
    expect(result.damageEvents.some(event => event.actionId === "incoming-intro")).toBe(true);
  });

  it("uses exact Sequence cooldown overrides for structured target triggers", () => {
    const statusEffect: EffectDefinition = {
      id: "sequence-icd",
      label: "Sequence ICD",
      source: { id: "fixture", type: "system", label: "Fixture" },
      target: "enemy",
      activationPolicy: "triggered",
      rules: [],
      statuses: [{ id: "stack", label: "Stack", maxStacks: 3 }],
      triggers: [{
        id: "damage-to-stack",
        event: "damage-dealt",
        operations: [{ kind: "apply-status", statusId: "stack", stacks: { kind: "constant", value: 1 } }],
        cooldown: { seconds: 2, scope: "target" },
        cooldownSecondsBySequence: { 4: 1, 5: 1, 6: 1 },
      }],
    };
    const steps = [
      { kind: "action" as const, actorId: "actor", actionId: "hit" },
      { kind: "wait" as const, seconds: 1 },
      { kind: "action" as const, actorId: "actor", actionId: "hit" },
    ];
    const s0 = simulateTeam({ actors: [actor("actor", 0, [action("hit")], [statusEffect])], activeActorId: "actor", target, steps });
    const s4 = simulateTeam({ actors: [actor("actor", 4, [action("hit")], [statusEffect])], activeActorId: "actor", target, steps });
    expect(Object.values(s0.targetsById.target.statuses)[0]?.stacks).toBe(1);
    expect(Object.values(s4.targetsById.target.statuses)[0]?.stacks).toBe(2);
  });

  it("does not leak higher-Sequence standard modifiers into lower-Sequence actors", () => {
    const sequenceEffect: EffectDefinition = {
      id: "sequence-damage",
      label: "Sequence damage",
      source: { id: "fixture", type: "system", label: "Fixture" },
      target: "self",
      activationPolicy: "initially-active",
      rules: [{
        id: "s5-damage",
        label: "S5 damage",
        accounting: "runtime",
        requiredSequence: 5,
        modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 100 }],
      }],
    };
    const s0 = simulateTeam({ actors: [actor("s0", 0, [action("hit")], [sequenceEffect])], activeActorId: "s0", target, steps: [{ kind: "action", actorId: "s0", actionId: "hit" }] });
    const s5 = simulateTeam({ actors: [actor("s5", 5, [action("hit")], [sequenceEffect])], activeActorId: "s5", target, steps: [{ kind: "action", actorId: "s5", actionId: "hit" }] });
    expect(s0.damageEvents[0].damage.status).toBe("supported");
    expect(s5.damageEvents[0].damage.status).toBe("supported");
    if (s0.damageEvents[0].damage.status === "supported" && s5.damageEvents[0].damage.status === "supported") {
      expect(s5.damageEvents[0].damage.total.expected).toBeGreaterThan(s0.damageEvents[0].damage.total.expected);
    }
  });
});
