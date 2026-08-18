import { describe, expect, it } from "vitest";

import { excludedRosterResonatorIds, roster10R1 } from "./roster-10r1";

describe("10R1 roster promotion registry", () => {
  it("contains exactly ten promoted Resonators", () => {
    expect(roster10R1).toHaveLength(10);
  });

  it("keeps domain ids, Wuwa ids and signature weapon ids unique", () => {
    expect(new Set(roster10R1.map((entry) => entry.id)).size).toBe(roster10R1.length);
    expect(new Set(roster10R1.map((entry) => entry.sourceItemId)).size).toBe(
      roster10R1.length,
    );
    expect(
      new Set(roster10R1.map((entry) => entry.signatureWeapon.id)).size,
    ).toBe(roster10R1.length);
    expect(
      new Set(roster10R1.map((entry) => entry.signatureWeapon.sourceItemId)).size,
    ).toBe(roster10R1.length);
  });

  it("uses numeric Wuwa ids only", () => {
    for (const entry of roster10R1) {
      expect(entry.sourceItemId).toMatch(/^\d+$/);
      expect(entry.signatureWeapon.sourceItemId).toMatch(/^\d+$/);
    }
  });

  it("explicitly excludes Camellya from promotion", () => {
    expect(excludedRosterResonatorIds).toContain("camellya");
    expect(roster10R1.some((entry) => entry.id === "camellya")).toBe(false);
    expect(roster10R1.some((entry) => /camell/i.test(entry.name))).toBe(false);
  });

  it("locks the reviewed first-batch order", () => {
    expect(roster10R1.map((entry) => entry.id)).toEqual([
      "aemeath",
      "augusta",
      "brant",
      "calcharo",
      "cantarella",
      "carlotta",
      "cartethyia",
      "changli",
      "chisa",
      "ciaccona",
    ]);
  });
});
