import { describe, expect, it } from "vitest";
import { calculateActionDamage } from "@/domain/damage-engine";
import { compareExternalDisplay } from "@/domain/external-benchmark";
import type { FinalStats } from "@/domain/models";
import { aemeathNakedStandardBenchmarks } from "./aemeath-external-benchmarks";
import {
  aemeathPersonalDpsProfile10R1,
  calcharoPersonalDpsProfile10R1,
  changliPersonalDpsProfile10R1,
  personalDpsPilotProfiles10R1,
} from "./personal-dps-pilots-10r1";

const emptyDamageBonuses: FinalStats["damageTypeBonus"] = {
  basicAttack: 0,
  heavyAttack: 0,
  resonanceSkill: 0,
  resonanceLiberation: 0,
  introSkill: 0,
  echoSkill: 0,
};

function nakedStats(input: {
  hp: number;
  attack: number;
  defense: number;
}): FinalStats {
  return {
    ...input,
    critRate: 5,
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
    damageTypeBonus: { ...emptyDamageBonuses },
  };
}

const target = (element: "electro" | "fusion") => ({
  level: 90,
  elementalResistance: { [element]: 0.1 },
  physicalResistance: 0.1,
});

const calcharoWutheringTools = {
  "calcharo-wanted-outlaw": [393, 402, 589],
  "calcharo-phantom-etching": [1176, 1206, 1764],
  "calcharo-death-messenger": [1928, 1976, 2892],
  "calcharo-hounds-roar-1": [174, 178, 261],
  "calcharo-hounds-roar-2": [348, 356, 521],
  "calcharo-hounds-roar-3": [324, 332, 485],
  "calcharo-extermination-order-1": [339, 348, 509],
  "calcharo-extermination-order-2": [509, 522, 763],
} as const;

const changliWutheringTools = {
  "changli-obedience-of-rules": [269, 276, 403],
  "changli-true-sight-charge": [329, 337, 493],
  "changli-heavy-attack": [225, 231, 338],
  "changli-basic-3": [198, 203, 297],
  "changli-basic-4": [306, 314, 459],
  "changli-true-sight-conquest": [534, 547, 800],
  "changli-true-sight-capture": [741, 760, 1111],
  "changli-flaming-sacrifice": [1184, 1213, 1775],
  "changli-radiance-of-fealty": [2194, 2249, 3291],
} as const;

function expectDisplayedMatch(
  raw: { nonCrit: number; expected: number; crit: number },
  expected: readonly [number, number, number],
  tolerance = 0,
): void {
  expect(
    compareExternalDisplay(raw.nonCrit, expected[0], "ceiling", tolerance).matches,
  ).toBe(true);
  expect(
    compareExternalDisplay(raw.expected, expected[1], "ceiling", tolerance).matches,
  ).toBe(true);
  expect(
    compareExternalDisplay(raw.crit, expected[2], "ceiling", tolerance).matches,
  ).toBe(true);
}

describe("10R1 universal personal-DPS pilot profiles", () => {
  it("contains exactly the three reviewed pilots with no duplicate ids", () => {
    expect(personalDpsPilotProfiles10R1.map((profile) => profile.resonatorId)).toEqual([
      "aemeath",
      "calcharo",
      "changli",
    ]);
    expect(new Set(personalDpsPilotProfiles10R1.map((profile) => profile.resonatorId)).size).toBe(3);
  });

  it("keeps Aemeath action damage aligned with the existing WutheringTools transcription", () => {
    const actions = new Map(
      aemeathPersonalDpsProfile10R1.actions.map((action) => [action.id, action] as const),
    );

    for (const benchmark of aemeathNakedStandardBenchmarks) {
      const action = actions.get(benchmark.actionId);
      expect(action, benchmark.actionId).toBeDefined();
      if (!action) continue;
      const result = calculateActionDamage({
        action,
        finalStats: benchmark.finalStats,
        attackerLevel: benchmark.characterLevel,
        scalingAttribute: "attack",
        element: "fusion",
        target: {
          level: benchmark.targetLevel,
          elementalResistance: { fusion: benchmark.targetResistance.elemental },
          physicalResistance: benchmark.targetResistance.physical,
        },
      });
      expect(result.status, benchmark.actionId).toBe("supported");
      if (result.status !== "supported") continue;
      expectDisplayedMatch(
        result.total,
        [
          benchmark.expectedDisplayed.normal,
          benchmark.expectedDisplayed.average,
          benchmark.expectedDisplayed.crit,
        ],
        benchmark.displayTolerance ?? 0,
      );
    }
  });

  it("matches WutheringTools Calcharo Lv90 naked fixture with identical displayed stats", () => {
    const stats = nakedStats({ hp: 10500, attack: 437, defense: 1185 });
    for (const action of calcharoPersonalDpsProfile10R1.actions) {
      const expected = calcharoWutheringTools[
        action.id as keyof typeof calcharoWutheringTools
      ];
      expect(expected, action.id).toBeDefined();
      if (!expected) continue;
      const result = calculateActionDamage({
        action,
        finalStats: stats,
        attackerLevel: 90,
        scalingAttribute: "attack",
        element: "electro",
        target: target("electro"),
      });
      expect(result.status, action.id).toBe("supported");
      if (result.status !== "supported") continue;
      expectDisplayedMatch(result.total, expected);
    }
  });

  it("matches WutheringTools Changli Lv80 naked fixture with identical displayed stats", () => {
    const stats = nakedStats({ hp: 9133, attack: 412, defense: 967 });
    for (const action of changliPersonalDpsProfile10R1.actions) {
      const expected = changliWutheringTools[
        action.id as keyof typeof changliWutheringTools
      ];
      expect(expected, action.id).toBeDefined();
      if (!expected) continue;
      const result = calculateActionDamage({
        action,
        finalStats: stats,
        attackerLevel: 80,
        scalingAttribute: "attack",
        element: "fusion",
        target: target("fusion"),
      });
      expect(result.status, action.id).toBe("supported");
      if (result.status !== "supported") continue;
      expectDisplayedMatch(result.total, expected);
    }
  });
});
