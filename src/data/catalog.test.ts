import { describe, expect, it } from "vitest";
import { mainEchoes, presets, resonators, sonatas, weapons } from "./catalog";

describe("cohérence du catalogue", () => {
  it("utilise des identifiants uniques", () => {
    for (const collection of [
      resonators,
      weapons,
      sonatas,
      mainEchoes,
      presets,
    ]) {
      expect(new Set(collection.map((entry) => entry.id)).size).toBe(
        collection.length,
      );
    }
  });

  it("garantit les références et la compatibilité des armes", () => {
    for (const preset of presets) {
      const resonator = resonators.find(
        (entry) => entry.id === preset.resonatorId,
      );
      const weapon = weapons.find(
        (entry) => entry.id === preset.weapon.weaponId,
      );
      expect(resonator).toBeDefined();
      expect(weapon?.type).toBe(resonator?.weaponType);
      expect(sonatas.some((entry) => entry.id === preset.sonataId)).toBe(true);
      expect(mainEchoes.some((entry) => entry.id === preset.mainEchoId)).toBe(
        true,
      );
    }
  });

  it("identifie explicitement toutes les données actuelles comme fixtures", () => {
    for (const collection of [
      resonators,
      weapons,
      sonatas,
      mainEchoes,
      presets,
    ]) {
      expect(
        collection.every((entry) => entry.source.kind === "technical-fixture"),
      ).toBe(true);
    }
  });
});
