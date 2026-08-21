import { describe, expect, it } from "vitest";
import { presets, resonators, weapons, sonatas, mainEchoes } from "@/data/catalog";
import { createBuildFromPreset } from "./character-box";
import type { EffectDefinition } from "./effect-models";
import type { CombatAction, Resonator, UserBuild } from "./models";
import { simulateTeam, type TeamActorInput } from "./team-engine";
import {
  buildSequentialTeamCycle,
  buildTeamActorInputs,
} from "./team-rotation-builder";

const source = {
  kind: "technical-fixture" as const,
  source: "Team sequential-cycle integration fixture",
};

const stats = {
  hp: 1000,
  attack: 100,
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

function fixtureAction(
  id: string,
  talent: "basicAttack" | "introSkill",
): CombatAction {
  return {
    id,
    name: id,
    talent,
    damageType: talent,
    level: 1,
    multipliers: [{ percent: 100, hits: 1 }],
    castDurationSeconds: { value: 0, confidence: "technical-fixture" },
    recoverySeconds: { value: 0, confidence: "technical-fixture" },
    hitTimingsSeconds: { value: [0], confidence: "technical-fixture" },
    source,
  };
}

function fixtureResonator(id: string): Resonator {
  return {
    id,
    name: id,
    element: "aero",
    weaponType: "sword",
    rarity: 5,
    baseStats: [{ level: 1, hp: 1000, attack: 100, defense: 100 }],
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
      forms: [],
      modes: [],
      resources: [
        {
          id: "concerto",
          name: "Concerto",
          cap: 100,
          semantic: "concerto-energy",
          notes: [],
        },
      ],
      actions: [
        fixtureAction(`${id}-action`, "basicAttack"),
        fixtureAction(`${id}-intro`, "introSkill"),
      ],
      effects: [],
      rotations: [],
      unknowns: [],
      source,
    },
    source,
  };
}

function fixtureBuild(id: string): UserBuild {
  return {
    id: `build-${id}`,
    resonatorId: id,
    sourcePresetId: `preset-${id}`,
    characterLevel: 1,
    sequence: 0,
    skillLevels: {
      basicAttack: 1,
      resonanceSkill: 1,
      forteCircuit: 1,
      resonanceLiberation: 1,
      introSkill: 1,
    },
    weapon: { weaponId: `weapon-${id}`, level: 1, rank: 1 },
    finalStats: {
      ...stats,
      elementalDamageBonus: { ...stats.elementalDamageBonus },
      damageTypeBonus: { ...stats.damageTypeBonus },
    },
    createdAt: "fixture",
    updatedAt: "fixture",
  };
}

const thirdToFirstBuff: EffectDefinition = {
  id: "third-to-first-outro-buff",
  label: "Third actor -> first actor Outro buff",
  source: { id: "slot-3-source", type: "resonator", label: "Slot 3 Outro" },
  target: "incoming-resonator",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 10 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "third-to-first-outro-buff-rule",
      label: "+25% All DMG",
      accounting: "runtime",
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 25 }],
    },
  ],
  triggers: [
    {
      id: "third-to-first-outro-trigger",
      event: "outro",
      operations: [
        { kind: "activate-effect", effectId: "third-to-first-outro-buff" },
      ],
    },
  ],
};

describe("sequential Team cycle integration", () => {
  it("keeps a third actor Outro buff alive when the closed cycle returns to actor one", () => {
    const actors: TeamActorInput[] = ["slot-1", "slot-2", "slot-3"].map(
      (actorId) => ({
        actorId,
        resonator: fixtureResonator(actorId),
        build: fixtureBuild(actorId),
        initialResources: { concerto: actorId === "slot-3" ? 100 : 0 },
        ...(actorId === "slot-3" ? { effects: [thirdToFirstBuff] } : {}),
      }),
    );

    const cycle = buildSequentialTeamCycle([
      {
        actorId: "slot-1",
        steps: [
          { kind: "action", actionId: "slot-1-action", durationOverrideSeconds: 0 },
        ],
      },
      {
        actorId: "slot-2",
        steps: [
          { kind: "action", actionId: "slot-2-action", durationOverrideSeconds: 0 },
          { kind: "wait", seconds: 1.1 },
        ],
      },
      {
        actorId: "slot-3",
        steps: [
          { kind: "action", actionId: "slot-3-action", durationOverrideSeconds: 0 },
        ],
      },
    ]);

    const result = simulateTeam({
      actors,
      activeActorId: cycle.startingActorId!,
      target: {
        level: 90,
        physicalResistance: 0,
        elementalResistance: { aero: 0 },
      },
      steps: cycle.steps,
    });

    expect(result.activeActorId).toBe("slot-1");
    expect(
      result.diagnostics.filter((item) =>
        ["inactive-actor-action", "switch-cooldown", "invalid-switch-target"].includes(
          item.code,
        ),
      ),
    ).toEqual([]);
    expect(
      result.eventLog
        .filter((event) => event.kind === "switch-in")
        .map((event) => event.ownerId),
    ).toEqual(["slot-2", "slot-3", "slot-1"]);

    const outro = result.eventLog.find(
      (event) => event.kind === "outro" && event.ownerId === "slot-3",
    );
    expect(outro?.payload?.incomingActorId).toBe("slot-1");

    const carried = result.activeEffects.find(
      (effect) => effect.definition.id === "third-to-first-outro-buff",
    );
    expect(carried).toMatchObject({
      ownerId: "slot-3",
      affectedEntityIds: ["slot-1"],
    });
    expect(carried?.endTimeSeconds).toBeGreaterThan(result.currentTimeSeconds);

    const returningIntro = result.damageEvents.find(
      (event) => event.actionId === "slot-1-intro",
    );
    expect(
      returningIntro?.effectAudit.some((entry) =>
        entry.contributions.some(
          (contribution) => contribution.kind === "all-damage-bonus",
        ),
      ),
    ).toBe(true);
  });

  it("binds precise 3+2 Echo-derived Sonata effects and base stat basis for arbitrary Team slots", () => {
    const qiuyuanPreset = presets.find((preset) => preset.resonatorId === "qiuyuan")!;
    const galbrenaPreset = presets.find((preset) => preset.resonatorId === "galbrena")!;
    const qiuyuanBuild = createBuildFromPreset(qiuyuanPreset, {
      id: "team-qiuyuan",
      now: "2026-08-21T14:00:00.000Z",
    });
    const galbrenaBuild = createBuildFromPreset(galbrenaPreset, {
      id: "team-galbrena",
      now: "2026-08-21T14:00:00.000Z",
    });

    const built = buildTeamActorInputs(
      [galbrenaBuild, qiuyuanBuild],
      { resonators, weapons, sonatas, mainEchoes },
      {},
      {
        "team-galbrena": "slot-1",
        "team-qiuyuan": "slot-3",
      },
    );

    expect(built.diagnostics).toEqual([]);
    expect(built.actors.map((actor) => actor.actorId)).toEqual(["slot-1", "slot-3"]);

    const galbrena = built.actors.find((actor) => actor.actorId === "slot-1")!;
    const qiuyuan = built.actors.find((actor) => actor.actorId === "slot-3")!;
    expect(galbrena.baseStatBasis).toBeDefined();
    expect(qiuyuan.baseStatBasis).toBeDefined();

    expect(galbrena.effects?.map((effect) => effect.id)).toEqual(
      expect.arrayContaining([
        "sonata-set:22:3pc:heavy-crit",
        "sonata-set:22:3pc:echo-crit",
        "sonata-set:22:3pc:fusion-conjunction",
        "sonata-set:28:2pc:fusion",
      ]),
    );
    expect(qiuyuan.effects?.map((effect) => effect.id)).toEqual(
      expect.arrayContaining([
        "sonata-set:21:3pc:heavy-self",
        "sonata-set:29:2pc:aero",
      ]),
    );
  });
});
