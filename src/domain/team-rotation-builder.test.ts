import { describe, expect, it } from "vitest";
import type { Resonator, UserBuild } from "./models";
import {
  SEQUENTIAL_TEAM_POLICY,
  actorIdForBuild,
  buildSequentialTeamCycle,
  buildTeamActorInputs,
  deriveRotationActionOptions,
  parseTeamRotationDraft,
  walkRotationActiveActors,
} from "./team-rotation-builder";

const source = { kind: "technical-fixture" as const, source: "future fixture" };
const future: Resonator = {
  id: "future",
  name: "Future",
  element: "aero",
  weaponType: "pistols",
  rarity: 4,
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
    effects: [],
    rotations: [],
    unknowns: [],
    source,
    actions: [
      {
        id: "future-action",
        name: "Future Action",
        talent: "basicAttack",
        damageType: "basicAttack",
        level: 1,
        multipliers: [{ percent: 100, hits: 1 }],
        castDurationSeconds: { value: null, confidence: "unknown" },
        recoverySeconds: { value: null, confidence: "unknown" },
        hitTimingsSeconds: { value: null, confidence: "unknown" },
        source,
      },
      {
        id: "semantic-intro",
        name: "Not named Intro",
        talent: "introSkill",
        level: 1,
        multipliers: [],
        castDurationSeconds: { value: null, confidence: "unknown" },
        recoverySeconds: { value: null, confidence: "unknown" },
        hitTimingsSeconds: { value: null, confidence: "unknown" },
        source,
      },
    ],
  },
  source,
};

const build = {
  id: "b",
  resonatorId: "future",
  sourcePresetId: "p",
  characterLevel: 1,
  sequence: 0,
  skillLevels: {
    basicAttack: 1,
    resonanceSkill: 1,
    forteCircuit: 1,
    resonanceLiberation: 1,
    introSkill: 1,
  },
  weapon: { weaponId: "w", level: 1, rank: 1 },
  finalStats: {
    hp: 1,
    attack: 1,
    defense: 1,
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
  createdAt: "",
  updatedAt: "",
} satisfies UserBuild;

describe("Team Rotation Builder domain", () => {
  it("derives a future action generically and hides semantic Intro", () =>
    expect(deriveRotationActionOptions(future, build)).toEqual([
      {
        id: "future-action",
        name: "Future Action",
        timing: "missing",
        talentStatus: "exact",
      },
    ]));

  it("walks switches without rewriting authored action ownership", () =>
    expect(
      walkRotationActiveActors("a", [
        { kind: "action", actorId: "a", actionId: "x" },
        { kind: "switch", toActorId: "b" },
        { kind: "action", actorId: "a", actionId: "x" },
      ]),
    ).toEqual(["a", "a", "b"]));

  it("compiles P1 -> P2 -> P3 -> P1 as one structural no-quickswap cycle", () => {
    const result = buildSequentialTeamCycle([
      {
        actorId: "p1",
        steps: [
          { kind: "action", actionId: "p1-a", repeat: 2 },
          { kind: "wait", seconds: 0.25 },
        ],
      },
      {
        actorId: "p2",
        steps: [{ kind: "action", actionId: "p2-a" }],
      },
      {
        actorId: "p3",
        steps: [{ kind: "action", actionId: "p3-a", targetId: "boss" }],
      },
    ]);

    expect(result.policy).toBe(SEQUENTIAL_TEAM_POLICY);
    expect(result.actorOrder).toEqual(["p1", "p2", "p3"]);
    expect(result.startingActorId).toBe("p1");
    expect(result.diagnostics).toEqual([]);
    expect(result.steps).toEqual([
      { kind: "action", actorId: "p1", actionId: "p1-a" },
      { kind: "action", actorId: "p1", actionId: "p1-a" },
      { kind: "wait", seconds: 0.25 },
      { kind: "switch", toActorId: "p2" },
      { kind: "action", actorId: "p2", actionId: "p2-a" },
      { kind: "switch", toActorId: "p3" },
      { kind: "action", actorId: "p3", actionId: "p3-a", targetId: "boss" },
      { kind: "switch", toActorId: "p1" },
    ]);

    const activeByStep = walkRotationActiveActors("p1", result.steps);
    result.steps.forEach((step, index) => {
      if (step.kind === "action") {
        expect(step.actorId).toBe(activeByStep[index]);
      }
    });
  });

  it("can leave the third actor active when explicitly building an open pass", () => {
    const result = buildSequentialTeamCycle(
      [
        { actorId: "p1", steps: [{ kind: "action", actionId: "a" }] },
        { actorId: "p2", steps: [{ kind: "action", actionId: "b" }] },
        { actorId: "p3", steps: [{ kind: "action", actionId: "c" }] },
      ],
      { closeCycle: false },
    );
    expect(result.steps.at(-1)).toEqual({
      kind: "action",
      actorId: "p3",
      actionId: "c",
    });
  });

  it("fails closed for invalid sequential blocks instead of generating quickswap-like steps", () => {
    expect(
      buildSequentialTeamCycle([
        { actorId: "same", steps: [{ kind: "action", actionId: "a" }] },
        { actorId: "same", steps: [{ kind: "action", actionId: "b" }] },
      ]),
    ).toMatchObject({
      steps: [],
      diagnostics: ["duplicate-actor-id:same"],
    });

    expect(
      buildSequentialTeamCycle([
        {
          actorId: "p1",
          steps: [{ kind: "action", actionId: "a", repeat: 0 }],
        },
      ]),
    ).toMatchObject({
      steps: [],
      diagnostics: ["invalid-repeat:p1:a"],
    });
  });

  it("keeps actor identity tied to the build instead of array position", () => {
    const catalog = {
      resonators: [future],
      weapons: [],
      sonatas: [],
      mainEchoes: [],
    };
    const b2 = { ...build, id: "b2" };
    expect(buildTeamActorInputs([build, b2], catalog).actors.map((actor) => actor.actorId)).toEqual([
      actorIdForBuild("b"),
      actorIdForBuild("b2"),
    ]);
    expect(buildTeamActorInputs([b2], catalog).actors[0]?.actorId).toBe(
      actorIdForBuild("b2"),
    );
    expect(
      buildTeamActorInputs([build], catalog, {}, { b: "legacy-slot" }).actors[0]
        ?.actorId,
    ).toBe("legacy-slot");
  });

  it("rejects malformed persistence", () => {
    expect(parseTeamRotationDraft("bad")).toBeUndefined();
    expect(parseTeamRotationDraft(JSON.stringify({ version: 2 }))).toBeUndefined();
    const draft = {
      version: 1 as const,
      selectedBuildIds: ["b"],
      actorIds: ["team-slot-1"],
      startingActorId: "team-slot-1",
      steps: [],
      initialResourcesByActorId: { "team-slot-1": { meter: 7 } },
    };
    expect(
      parseTeamRotationDraft(JSON.stringify(draft))?.initialResourcesByActorId,
    ).toEqual(draft.initialResourcesByActorId);
  });
});
