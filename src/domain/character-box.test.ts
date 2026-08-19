import { describe, expect, it } from "vitest";
import { presets } from "@/data/catalog";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import {
  MAX_CHARACTER_BOX_SERIALIZED_LENGTH,
  addBuild,
  createBuildFromPreset,
  emptyCharacterBox,
  isSequence,
  parseCharacterBox,
  removeBuild,
  resetBuild,
  updateBuild,
} from "./character-box";

const aemeathPreset = presets.find((preset) => preset.resonatorId === "aemeath")!;
const fixturePreset = presets.find(
  (preset) => preset.source.kind === "technical-fixture",
)!;
const chisaPreset = presets.find((preset)=>preset.resonatorId==="chisa")!;

const createBuild = (preset = aemeathPreset, index = 0) =>
  createBuildFromPreset(preset, {
    id: `build-${index}`,
    now: "2026-08-15T00:00:00.000Z",
  });

describe("Character Box", () => {
  it("crée une copie indépendante depuis un preset", () => {
    const preset = aemeathPreset;
    const originalAttack = preset.finalStats.attack;
    const originalFusion = preset.finalStats.elementalDamageBonus.fusion;
    const build = createBuild();
    build.skillLevels.basicAttack = 8;
    build.weapon.level = 90;
    build.finalStats.attack = 2400;
    build.finalStats.elementalDamageBonus.fusion = 55;
    expect(preset.skillLevels.basicAttack).toBe(10);
    expect(preset.weapon.level).toBe(90);
    expect(preset.finalStats.attack).toBe(originalAttack);
    expect(preset.finalStats.elementalDamageBonus.fusion).toBe(originalFusion);
  });

  it("copie et sanitise génériquement un Echo loadout de preset", () => {
    const echoLoadout = generatedCommunityEchoPresets10R1.augusta.echoLoadout;
    const preset = { ...fixturePreset, echoLoadout };
    const build = createBuildFromPreset(preset, {
      id: "build-with-echoes",
      now: "2026-08-15T00:00:00.000Z",
    });

    expect(build.echoLoadout).toEqual(echoLoadout);
    expect(build.echoLoadout).not.toBe(echoLoadout);
    expect(build.echoLoadout?.echoes).not.toBe(echoLoadout.echoes);
    expect(
      parseCharacterBox(JSON.stringify({ schemaVersion: 1, builds: [build] }))
        .builds[0]?.echoLoadout,
    ).toEqual(echoLoadout);
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
    const presetAttack = aemeathPreset.finalStats.attack;
    const edited = {
      ...createBuild(),
      characterLevel: 90,
      finalStats: { ...createBuild().finalStats, attack: 2500 },
    };
    const reset = resetBuild(edited, aemeathPreset, "2026-08-16T00:00:00.000Z");
    expect(reset.characterLevel).toBe(90);
    expect(reset.finalStats.attack).toBe(presetAttack);
    expect(reset.createdAt).toBe(edited.createdAt);
    expect(reset.updatedAt).toBe("2026-08-16T00:00:00.000Z");
    reset.finalStats.attack = 1;
    expect(aemeathPreset.finalStats.attack).toBe(presetAttack);
  });

  it("valide uniquement les Sequences S0 à S6", () => {
    for (let value = 0; value <= 6; value += 1)
      expect(isSequence(value)).toBe(true);
    for (const value of [-1, 7, 1.5, "1", Number.NaN])
      expect(isSequence(value)).toBe(false);
  });

  it("conserve toutes les Sequences S0 à S6 dans la persistance", () => {
    for (let sequence = 0; sequence <= 6; sequence += 1) {
      const build = { ...createBuild(), sequence: sequence as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
      expect(parseCharacterBox(JSON.stringify({ schemaVersion: 1, builds: [build] })).builds[0].sequence).toBe(sequence);
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

  it("refuse une persistance anormalement volumineuse", () => {
    expect(
      parseCharacterBox("x".repeat(MAX_CHARACTER_BOX_SERIALIZED_LENGTH + 1)),
    ).toEqual(emptyCharacterBox());
  });

  it("supprime les propriétés inconnues de la persistance avant usage", () => {
    const build = createBuild();
    const serialized = JSON.stringify({
      schemaVersion: 1,
      untrustedRootField: "ignored",
      builds: [
        {
          ...build,
          untrustedBuildField: "ignored",
          weapon: { ...build.weapon, untrustedWeaponField: "ignored" },
          finalStats: {
            ...build.finalStats,
            untrustedStatsField: "ignored",
          },
        },
      ],
    });
    const parsed = parseCharacterBox(serialized);
    const restored = parsed.builds[0] as unknown as Record<string, unknown>;
    const restoredWeapon = restored.weapon as Record<string, unknown>;
    const restoredStats = restored.finalStats as Record<string, unknown>;

    expect(parsed.builds).toHaveLength(1);
    expect("untrustedRootField" in (parsed as unknown as Record<string, unknown>)).toBe(false);
    expect("untrustedBuildField" in restored).toBe(false);
    expect("untrustedWeaponField" in restoredWeapon).toBe(false);
    expect("untrustedStatsField" in restoredStats).toBe(false);
  });

  it("refuse les identifiants de persistance anormalement longs", () => {
    const build = { ...createBuild(), id: "x".repeat(201) };
    expect(
      parseCharacterBox(JSON.stringify({ schemaVersion: 1, builds: [build] })),
    ).toEqual(emptyCharacterBox());
  });

  it("normalise Tune Break Boost sans perdre les anciennes builds", () => {
    const aemeath = createBuild();
    const fixture = createBuild(fixturePreset, 1);
    const aemeathStats: Partial<typeof aemeath.finalStats> = { ...aemeath.finalStats };
    const fixtureStats: Partial<typeof fixture.finalStats> = { ...fixture.finalStats };
    delete aemeathStats.tuneBreakBoost;
    delete fixtureStats.tuneBreakBoost;
    const migrated = parseCharacterBox(JSON.stringify({
      schemaVersion: 1,
      builds: [
        { ...aemeath, finalStats: aemeathStats },
        { ...fixture, finalStats: fixtureStats },
      ],
    }));
    expect(migrated.builds).toHaveLength(2);
    expect(migrated.builds[0].finalStats.tuneBreakBoost).toBe(10);
    expect(migrated.builds[1].finalStats.tuneBreakBoost).toBe(0);
    expect(migrated.builds[0].finalStats.attack).toBe(aemeath.finalStats.attack);
  });

  it("refuse les niveaux d'aptitude hors de la plage 1 à 10", () => {
    for (const level of [0, 11, 1.5]) {
      const build = createBuild();
      build.skillLevels.forteCircuit = level;
      expect(() => addBuild(emptyCharacterBox(), build)).toThrow(/invalides/);
      expect(() =>
        updateBuild({ schemaVersion: 1, builds: [createBuild()] }, build),
      ).toThrow(/invalides/);
      expect(
        parseCharacterBox(
          JSON.stringify({ schemaVersion: 1, builds: [build] }),
        ),
      ).toEqual(emptyCharacterBox());
    }
  });

  it("crée et édite un build Chisa via le preset/catalogue générique",()=>{
    const chisa=createBuild(chisaPreset,2);
    expect(chisa).toMatchObject({resonatorId:"chisa",characterLevel:90,sequence:0,weapon:{weaponId:"kumokiri"}});
    const box=addBuild(emptyCharacterBox(),chisa);
    const edited={...chisa,skillLevels:{...chisa.skillLevels,resonanceSkill:6},sequence:4 as const};
    expect(updateBuild(box,edited).builds[0]).toMatchObject({sequence:4,skillLevels:{resonanceSkill:6}});
  });
});
