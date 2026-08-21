import { describe, expect, it } from "vitest";
import { isUserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import { reviewedEchoStatTableV1 } from "@/game-data/echo-stats-v1";

const rollsById = new Map(
  reviewedEchoStatTableV1.substatRolls.map((definition) => [
    definition.statId,
    definition.values,
  ] as const),
);

function oneEchoWithSubstats(
  substats: readonly { statId: string; value: number }[],
) {
  return {
    echoes: [
      {
        echoId: "echo:test",
        sonataSetId: "sonata:test",
        rarity: 5 as const,
        level: 25 as const,
        primaryMainStatId: "echo-main-4-crit-rate",
        substats,
      },
    ],
    mainEchoId: "echo:test",
  };
}

describe("Echo substat editing contract", () => {
  it("uses one shared reviewed substat pool with the exact Crit roll ladders", () => {
    expect(reviewedEchoStatTableV1.substatRolls).toHaveLength(13);
    expect(rollsById.get("echo-sub-crit-rate")).toEqual([
      6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5,
    ]);
    expect(rollsById.get("echo-sub-crit-damage")).toEqual([
      12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21,
    ]);
  });

  it("accepts five distinct substats on one Echo, including a substat matching its main stat family", () => {
    const loadout = oneEchoWithSubstats([
      { statId: "echo-sub-crit-rate", value: 10.5 },
      { statId: "echo-sub-crit-damage", value: 21 },
      { statId: "echo-sub-attack-percent", value: 11.6 },
      { statId: "echo-sub-resonance-skill-damage", value: 10.9 },
      { statId: "echo-sub-energy-regen", value: 12.4 },
    ]);

    expect(isUserEchoLoadoutV1(loadout)).toBe(true);
  });

  it("lets a precise Crit DMG roll move down or up without changing the selected stat", () => {
    const critDamageRolls = rollsById.get("echo-sub-crit-damage")!;
    const currentIndex = critDamageRolls.indexOf(17.4);

    expect(critDamageRolls[currentIndex - 1]).toBe(16.2);
    expect(critDamageRolls[currentIndex + 1]).toBe(18.6);
    expect(
      isUserEchoLoadoutV1(
        oneEchoWithSubstats([
          { statId: "echo-sub-crit-damage", value: critDamageRolls[currentIndex - 1]! },
        ]),
      ),
    ).toBe(true);
    expect(
      isUserEchoLoadoutV1(
        oneEchoWithSubstats([
          { statId: "echo-sub-crit-damage", value: critDamageRolls[currentIndex + 1]! },
        ]),
      ),
    ).toBe(true);
  });

  it("keeps duplicate copies of the same substat illegal on a single Echo", () => {
    const duplicateCrit = oneEchoWithSubstats([
      { statId: "echo-sub-crit-rate", value: 6.3 },
      { statId: "echo-sub-crit-rate", value: 10.5 },
    ]);

    expect(isUserEchoLoadoutV1(duplicateCrit)).toBe(false);
  });
});
