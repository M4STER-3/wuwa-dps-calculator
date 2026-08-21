import { describe, expect, it } from "vitest";
import type { Resonator } from "@/domain/models";
import { applyReviewedGameDatabaseTalentLevels } from "./reviewed-game-database-combat";

const source = { kind: "technical-fixture", source: "reviewed combat adapter test" } as const;
const unknownTiming = { value: null, confidence: "unknown" } as const;

function fixtureResonator(): Resonator {
  return {
    id: "fixture-resonator",
    name: "Fixture Resonator",
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
    source,
    combat: {
      level10Only: true,
      forms: [],
      modes: [],
      resources: [],
      actions: [
        {
          id: "fixture-action",
          name: "Fixture Action",
          talent: "basicAttack",
          damageType: "basicAttack",
          level: 10,
          multipliers: [{ percent: 100, hits: 1 }],
          castDurationSeconds: unknownTiming,
          recoverySeconds: unknownTiming,
          hitTimingsSeconds: unknownTiming,
          source,
        },
      ],
      effects: [],
      rotations: [],
      unknowns: ["Talent levels 2-9.", "Timing remains unknown."],
      source,
    },
  };
}

const projection = {
  sourceItemId: "fixture-id",
  name: "Fixture Resonator",
  mappedActions: [
    {
      actionId: "fixture-action",
      multipliersByTalentLevel: {
        1: [{ percent: 50, hits: 1 }],
        10: [{ percent: 100, hits: 1 }],
      },
    },
  ],
} as const;

describe("applyReviewedGameDatabaseTalentLevels", () => {
  it("applies reviewed talent levels to any resonator without changing unrelated unknowns", () => {
    const result = applyReviewedGameDatabaseTalentLevels(fixtureResonator(), projection);

    expect(result.combat?.level10Only).toBe(false);
    expect(result.combat?.actions[0]?.multipliersByTalentLevel?.[1]).toEqual([
      { percent: 50, hits: 1 },
    ]);
    expect(result.combat?.unknowns).toEqual(["Timing remains unknown."]);
  });

  it("rejects a projection for another resonator", () => {
    expect(() =>
      applyReviewedGameDatabaseTalentLevels(fixtureResonator(), {
        ...projection,
        name: "Another Resonator",
      }),
    ).toThrow(/identity mismatch/);
  });

  it("rejects an uncovered damage action", () => {
    expect(() =>
      applyReviewedGameDatabaseTalentLevels(fixtureResonator(), {
        ...projection,
        mappedActions: [],
      }),
    ).toThrow(/fixture-action is missing/);
  });
});
