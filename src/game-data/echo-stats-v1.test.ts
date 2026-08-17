import { describe, expect, it } from "vitest";
import { reviewedEchoStatTableV1 } from "./echo-stats-v1";

describe("reviewedEchoStatTableV1", () => {
  it("supports only exact five-star +25 main-stat points", () => {
    expect(reviewedEchoStatTableV1.supportedRarity).toBe(5);
    expect(reviewedEchoStatTableV1.primaryMainStatsByCost[1]).toHaveLength(3);
    expect(reviewedEchoStatTableV1.primaryMainStatsByCost[3]).toHaveLength(10);
    expect(reviewedEchoStatTableV1.primaryMainStatsByCost[4]).toHaveLength(6);

    const definitions = [
      ...reviewedEchoStatTableV1.primaryMainStatsByCost[1],
      ...reviewedEchoStatTableV1.primaryMainStatsByCost[3],
      ...reviewedEchoStatTableV1.primaryMainStatsByCost[4],
      reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[1],
      reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[3],
      reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[4],
    ];

    expect(new Set(definitions.map((entry) => entry.id)).size).toBe(definitions.length);
    for (const definition of definitions) {
      expect(definition.progression.interpolation).toBe("none");
      expect(definition.progression.points).toHaveLength(1);
      expect(definition.progression.points[0]?.level).toBe(25);
      expect(Number.isFinite(definition.progression.points[0]?.value)).toBe(true);
    }
  });

  it("keeps fixed secondary main stats separate from RNG primary main stats", () => {
    expect(reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[1]).toMatchObject({
      stat: "hp",
      application: "flat",
      progression: { points: [{ level: 25, value: 2280 }] },
    });
    expect(reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[3]).toMatchObject({
      stat: "attack",
      application: "flat",
      progression: { points: [{ level: 25, value: 100 }] },
    });
    expect(reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[4]).toMatchObject({
      stat: "attack",
      application: "flat",
      progression: { points: [{ level: 25, value: 150 }] },
    });
  });

  it("contains the reviewed endgame primary maxima", () => {
    const byId = new Map(
      [
        ...reviewedEchoStatTableV1.primaryMainStatsByCost[1],
        ...reviewedEchoStatTableV1.primaryMainStatsByCost[3],
        ...reviewedEchoStatTableV1.primaryMainStatsByCost[4],
      ].map((entry) => [entry.id, entry.progression.points[0]?.value]),
    );
    expect(byId.get("echo-main-1-hp-percent")).toBe(22.8);
    expect(byId.get("echo-main-1-attack-percent")).toBe(18);
    expect(byId.get("echo-main-3-attack-percent")).toBe(30);
    expect(byId.get("echo-main-3-defense-percent")).toBe(38);
    expect(byId.get("echo-main-3-energy-regen")).toBe(32);
    expect(byId.get("echo-main-3-fusion-damage")).toBe(30);
    expect(byId.get("echo-main-4-attack-percent")).toBe(33);
    expect(byId.get("echo-main-4-defense-percent")).toBe(41.5);
    expect(byId.get("echo-main-4-crit-rate")).toBe(22);
    expect(byId.get("echo-main-4-crit-damage")).toBe(44);
    expect(byId.get("echo-main-4-healing-bonus")).toBe(26);
  });

  it("contains exact reviewed five-star substat rolls without invented stat families", () => {
    const rolls = new Map(reviewedEchoStatTableV1.substatRolls.map((entry) => [entry.statId, entry.values]));
    expect(rolls.get("echo-sub-attack-flat")).toEqual([30, 40, 50, 60]);
    expect(rolls.get("echo-sub-defense-flat")).toEqual([40, 50, 60, 70]);
    expect(rolls.get("echo-sub-hp-flat")).toEqual([320, 360, 390, 430, 470, 510, 540, 580]);
    expect(rolls.get("echo-sub-crit-rate")).toEqual([6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5]);
    expect(rolls.get("echo-sub-crit-damage")).toEqual([12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21]);
    expect(rolls.get("echo-sub-energy-regen")).toEqual([6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4]);
    expect(reviewedEchoStatTableV1.substatRolls).toHaveLength(13);
    expect(reviewedEchoStatTableV1.substatRolls.some((entry) => entry.stat.includes("tune"))).toBe(false);
    expect(new Set(reviewedEchoStatTableV1.substatRolls.map((entry) => entry.statId)).size).toBe(13);
  });
});
