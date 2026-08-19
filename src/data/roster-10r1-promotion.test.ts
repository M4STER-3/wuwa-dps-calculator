import { describe, expect, it } from "vitest";

import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { presets, resonators, weapons } from "./catalog";
import { excludedRosterResonatorIds, roster10R1 } from "./roster-10r1";

const realResonators = resonators.filter(
  (entry) => entry.source.kind !== "technical-fixture",
);

const contentAddressedAsset =
  /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/;

const promotedEchoStatuses = new Set(["verified", "curated-balanced"]);

describe("10R1 functional Character Box promotion", () => {
  it("promotes every reviewed 10R1 Resonator exactly once", () => {
    for (const reviewed of roster10R1) {
      expect(
        realResonators.filter((entry) => entry.id === reviewed.id),
        reviewed.id,
      ).toHaveLength(1);
    }
  });

  it("keeps Camellya structurally excluded", () => {
    expect(excludedRosterResonatorIds).toContain("camellya");
    expect(realResonators.some((entry) => entry.id === "camellya")).toBe(false);
    expect(presets.some((entry) => entry.resonatorId === "camellya")).toBe(false);
  });

  it("keeps reviewed identity, weapon type and local portrait for every 10R1 Resonator", () => {
    for (const reviewed of roster10R1) {
      const resonator = realResonators.find((entry) => entry.id === reviewed.id);
      expect(resonator).toMatchObject({
        name: reviewed.name,
        element: reviewed.element,
        weaponType: reviewed.weaponType,
        rarity: 5,
      });
      expect(resonator?.portrait?.src).toMatch(contentAddressedAsset);
      expect(resonator?.resonanceChain.map((entry) => entry.sequence)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
    }
  });

  it("promotes every reviewed signature weapon with compatible type", () => {
    for (const reviewed of roster10R1) {
      const weapon = weapons.find(
        (entry) => entry.id === reviewed.signatureWeapon.id,
      );
      expect(weapon).toMatchObject({
        name: reviewed.signatureWeapon.name,
        type: reviewed.weaponType,
        rarity: 5,
      });
    }
  });

  it("makes every 10R1 Resonator addable through a preset", () => {
    for (const reviewed of roster10R1) {
      const matching = presets.filter(
        (entry) => entry.resonatorId === reviewed.id,
      );
      expect(matching.length, reviewed.id).toBeGreaterThan(0);
    }
  });

  it("uses exact incomplete baselines for the seven promoted Resonators that do not yet own rich combat data", () => {
    const baselineIds = new Set([
      "augusta",
      "brant",
      "cantarella",
      "carlotta",
      "cartethyia",
      "changli",
      "ciaccona",
    ]);

    for (const reviewed of roster10R1.filter((entry) => baselineIds.has(entry.id))) {
      const preset = presets.find((entry) => entry.resonatorId === reviewed.id);
      expect(preset).toMatchObject({
        characterLevel: 90,
        sequence: 0,
        skillLevels: {
          basicAttack: 10,
          resonanceSkill: 10,
          forteCircuit: 10,
          resonanceLiberation: 10,
          introSkill: 10,
        },
        weapon: {
          weaponId: reviewed.signatureWeapon.id,
          level: 90,
          rank: 1,
        },
      });
      expect(preset?.sonataId).toBeUndefined();
      expect(preset?.mainEchoId).toBeUndefined();
      expect(preset?.notes.join(" ")).toMatch(/non résolu/i);
      expect(preset?.source.kind).toBe("verified-game-data");
    }
  });

  it("promotes Calcharo to the same rich equipment contract as the other combat-ready pilots", () => {
    const preset = presets.find((entry) => entry.resonatorId === "calcharo");
    expect(preset).toMatchObject({
      characterLevel: 90,
      sequence: 0,
      weapon: { weaponId: "lustrous-razor", level: 90, rank: 1 },
      sonataId: "void-thunder",
      mainEchoId: "nightmare-thundering-mephis",
      source: { kind: "multi-source-verified" },
    });
    expect(preset?.echoLoadout).toEqual(
      generatedCommunityEchoPresets10R1.calcharo.echoLoadout,
    );
  });

  it("attaches Echo loadouts to every explicitly promoted community or curated candidate", () => {
    for (const [resonatorId, community] of Object.entries(
      generatedCommunityEchoPresets10R1,
    )) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId);
      expect(preset, resonatorId).toBeDefined();
      if (promotedEchoStatuses.has(community.promotionStatus)) {
        expect(preset?.echoLoadout, resonatorId).toEqual(community.echoLoadout);
      } else {
        expect(preset?.echoLoadout, resonatorId).toBeUndefined();
      }
    }
  });
});
