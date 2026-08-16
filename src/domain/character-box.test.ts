import { describe, expect, it } from "vitest";
import { presets } from "@/data/catalog";
import {
  addBuild,
  clampBuildNumber,
  createBuildFromPreset,
  emptyCharacterBox,
  isSequence,
  parseCharacterBox,
  removeBuild,
  resetBuild,
  updateBuild,
} from "./character-box";

const aemeathPreset = presets.find(
  (preset) => preset.resonatorId === "aemeath",
)!;
const fixturePreset = presets.find(
  (preset) => preset.source.kind === "technical-fixture",
)!;

const createBuild = (preset = aemeathPreset, index = 0) =>
  createBuildFromPreset(preset, {
    id: `build-${index}`,
    now: "2026-08-15T00:00:00.000Z",
  });

describe("Character Box", () => {
  it("crée une copie indépendante depuis un preset", () => {
    const preset = aemeathPreset;
    const build = createBuild();
    build.skillLevels.basicAttack = 8;
    build.weapon.level = 90;
    build.finalStats.attack = 2400;
    build.finalStats.elementalDamageBonus.fusion = 55;
    expect(preset.skillLevels.basicAttack).toBe(10);
    expect(preset.weapon.level).toBe(90);
    expect(preset.finalStats.attack).toBe(2000);
    expect(preset.finalStats.elementalDamageBonus.fusion).toBe(40);
  });

  it("empêche deux builds du même Resonator", () => {
    const build = createBuild();
    const box = addBuild(emptyCharacterBox(), build);
    expect(() => addBuild(box, { ...build, id: "another" })).toThrow(
      /déjà présent/,
    );
  });

  it("met à jour et supprime un build sans toucher aux autres", () => {
    const first = createBuild(aemeathPreset, 0);
    const second = createBuild(fixturePreset, 1);
    const box = addBuild(addBuild(emptyCharacterBox(), first), second);
    const updated = { ...first, characterLevel: 90 };
    const afterUpdate = updateBuild(box, updated);
    expect(afterUpdate.builds).toEqual([updated, second]);
    expect(removeBuild(afterUpdate, first.id).builds).toEqual([second]);
  });

  it("réinitialise avec une nouvelle copie tout en conservant la création", () => {
    const edited = {
      ...createBuild(),
      characterLevel: 90,
      finalStats: { ...createBuild().finalStats, attack: 2500 },
    };
    const reset = resetBuild(edited, aemeathPreset, "2026-08-16T00:00:00.000Z");
    expect(reset.characterLevel).toBe(90);
    expect(reset.finalStats.attack).toBe(2000);
    expect(reset.createdAt).toBe(edited.createdAt);
    expect(reset.updatedAt).toBe("2026-08-16T00:00:00.000Z");
    reset.finalStats.attack = 1;
    expect(aemeathPreset.finalStats.attack).toBe(2000);
  });

  it("valide uniquement les Sequences S0 à S6", () => {
    for (let value = 0; value <= 6; value += 1)
      expect(isSequence(value)).toBe(true);
    for (const value of [-1, 7, 1.5, "1", Number.NaN])
      expect(isSequence(value)).toBe(false);
  });

  it("borne les niveaux saisis et rejette les aptitudes invalides", () => {
    expect(clampBuildNumber(0, 1, 10, true)).toBe(1);
    expect(clampBuildNumber(11, 1, 10, true)).toBe(10);
    expect(clampBuildNumber(7.9, 1, 10, true)).toBe(7);

    const belowMinimum = createBuild();
    belowMinimum.skillLevels.basicAttack = 0;
    expect(
      parseCharacterBox(
        JSON.stringify({ schemaVersion: 1, builds: [belowMinimum] }),
      ),
    ).toEqual(emptyCharacterBox());

    const aboveMaximum = createBuild();
    aboveMaximum.skillLevels.introSkill = 11;
    expect(
      parseCharacterBox(
        JSON.stringify({ schemaVersion: 1, builds: [aboveMaximum] }),
      ),
    ).toEqual(emptyCharacterBox());
  });

  it("conserve toutes les Sequences S0 à S6 dans la persistance", () => {
    for (let sequence = 0; sequence <= 6; sequence += 1) {
      const build = {
        ...createBuild(),
        sequence: sequence as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      };
      expect(
        parseCharacterBox(JSON.stringify({ schemaVersion: 1, builds: [build] }))
          .builds[0].sequence,
      ).toBe(sequence);
    }
  });

  it("sérialise et restaure une Box valide", () => {
    const box = addBuild(emptyCharacterBox(), createBuild());
    expect(parseCharacterBox(JSON.stringify(box))).toEqual(box);
    expect(parseCharacterBox("invalid")).toEqual(emptyCharacterBox());
    expect(
      parseCharacterBox(JSON.stringify({ schemaVersion: 99, builds: [] })),
    ).toEqual(emptyCharacterBox());
  });
});
