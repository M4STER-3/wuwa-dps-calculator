import { describe, expect, it } from "vitest";
import type { CombatAction, FinalStats, Resonator, UserBuild } from "./models";
import { simulateTeam, type TeamActorInput } from "./team-engine";

const source = { kind: "technical-fixture" as const, source: "team duration validation regression" };
const target = { level: 90, elementalResistance: { spectro: 0 }, physicalResistance: 0 };

const finalStats: FinalStats = {
  hp: 1000,
  attack: 100,
  defense: 100,
  critRate: 0,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

const hit: CombatAction = {
  id: "hit",
  name: "Hit",
  talent: "basicAttack",
  damageType: "basicAttack",
  level: 1,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: 1, confidence: "technical-fixture" },
  recoverySeconds: { value: 0, confidence: "technical-fixture" },
  hitTimingsSeconds: { value: [0], confidence: "technical-fixture" },
  source,
};

function fixtureActor(): TeamActorInput {
  const resonator: Resonator = {
    id: "duration-fixture",
    name: "Duration Fixture",
    element: "spectro",
    weaponType: "rectifier",
    rarity: 5,
    skillNames: { basicAttack: "", resonanceSkill: "", forteCircuit: "", resonanceLiberation: "", introSkill: "" },
    resonanceChain: [],
    combat: { level10Only: false, forms: [], modes: [], resources: [], actions: [hit], effects: [], rotations: [], unknowns: [], source },
    source,
  };
  const build: UserBuild = {
    id: "duration-build",
    resonatorId: resonator.id,
    sourcePresetId: "fixture",
    characterLevel: 90,
    sequence: 0,
    skillLevels: { basicAttack: 1, resonanceSkill: 1, forteCircuit: 1, resonanceLiberation: 1, introSkill: 1 },
    weapon: { weaponId: "fixture", level: 90, rank: 1 },
    finalStats,
    createdAt: "",
    updatedAt: "",
  };
  return { actorId: "actor", resonator, build };
}

describe("Team Engine manual duration validation", () => {
  it.each([
    ["negative", -1],
    ["NaN", Number.NaN],
  ])("rejects a %s manual duration without corrupting global time", (_label, durationOverrideSeconds) => {
    const result = simulateTeam({
      actors: [fixtureActor()],
      activeActorId: "actor",
      target,
      steps: [{ kind: "action", actorId: "actor", actionId: "hit", durationOverrideSeconds }],
    });

    expect(Number.isFinite(result.currentTimeSeconds)).toBe(true);
    expect(result.currentTimeSeconds).toBe(0);
    expect(result.resolvedDurationSeconds).toBeUndefined();
    expect(result.diagnostics.some(diagnostic => diagnostic.code === "timing-required" && diagnostic.message.includes("finite and non-negative"))).toBe(true);
  });
});
