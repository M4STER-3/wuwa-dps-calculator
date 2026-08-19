import { describe, expect, it } from "vitest";
import { mainEchoes, presets, resonators, sonatas, weapons } from "./catalog";

const aemeath = resonators.find((entry) => entry.id === "aemeath")!;
const aemeathPreset = presets.find((entry) => entry.resonatorId === "aemeath")!;
const calcharo = resonators.find((entry) => entry.id === "calcharo")!;
const calcharoPreset = presets.find((entry) => entry.resonatorId === "calcharo")!;
const chisa = resonators.find((entry) => entry.id === "chisa")!;
const chisaPreset = presets.find((entry) => entry.resonatorId === "chisa")!;

describe("cohérence du catalogue", () => {
  it("utilise des identifiants uniques", () => {
    for (const collection of [resonators, weapons, sonatas, mainEchoes, presets]) {
      expect(new Set(collection.map((entry) => entry.id)).size).toBe(collection.length);
    }
  });

  it("garantit les références et la compatibilité des armes", () => {
    for (const preset of presets) {
      const resonator = resonators.find((entry) => entry.id === preset.resonatorId);
      const weapon = weapons.find((entry) => entry.id === preset.weapon.weaponId);
      expect(resonator).toBeDefined();
      expect(weapon?.type).toBe(resonator?.weaponType);
      if (preset.sonataId) {
        expect(sonatas.some((entry) => entry.id === preset.sonataId)).toBe(true);
      }
      if (preset.mainEchoId) {
        expect(mainEchoes.some((entry) => entry.id === preset.mainEchoId)).toBe(true);
      }
    }
  });

  it("intègre Aemeath comme donnée réelle et conserve les fixtures restantes explicites", () => {
    expect(aemeath.source.kind).toBe("multi-source-verified");
    expect(aemeath.name).toBe("Aemeath");
    expect(aemeath.element).toBe("fusion");
    expect(aemeath.weaponType).toBe("sword");
    expect(aemeath.resonanceChain.map((chain) => chain.sequence)).toEqual([1, 2, 3, 4, 5, 6]);

    const fixtureEntries = [resonators, weapons, sonatas, mainEchoes, presets]
      .flatMap((collection) => [...collection])
      .filter((entry) => entry.id.startsWith("fixture-") || entry.id.startsWith("preset-fixture-"));
    expect(fixtureEntries.length).toBeGreaterThan(0);
    expect(fixtureEntries.every((entry) => entry.source.kind === "technical-fixture")).toBe(true);
  });

  it("fournit le preset S0 Lv90 complet, ses cinq Echoes et son équipement vérifié", () => {
    expect(aemeathPreset).toMatchObject({
      id: "aemeath-s0-l90-everbright-trailblazing",
      characterLevel: 90,
      sequence: 0,
      skillLevels: {
        basicAttack: 10,
        resonanceSkill: 10,
        forteCircuit: 10,
        resonanceLiberation: 10,
        introSkill: 10,
      },
      progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
      weapon: { weaponId: "everbright-polestar", level: 90, rank: 1 },
      sonataId: "trailblazing-star",
      mainEchoId: "sigillum",
    });
    expect(aemeathPreset.source.kind).toBe("community-recommendation");
    expect(aemeathPreset.recommendedTargets?.attack).toEqual({ minimum: 2000, maximum: 2400 });
    expect(aemeathPreset.echoLoadout?.echoes).toHaveLength(5);
    expect(aemeathPreset.echoLoadout?.mainEchoId).toBeDefined();
    expect(aemeathPreset.finalStats.attack).toBeGreaterThan(2000);
    expect(aemeathPreset.finalStats.attack).toBeLessThanOrEqual(2400);
  });

  it("conserve les équipements riches vérifiés d'Aemeath et Calcharo dans le catalogue étendu", () => {
    expect(weapons.find((entry) => entry.id === "everbright-polestar")).toMatchObject({
      name: "Everbright Polestar",
      type: "sword",
      rarity: 5,
    });
    expect(weapons.find((entry) => entry.id === "lustrous-razor")).toMatchObject({
      name: "Lustrous Razor",
      type: "broadblade",
      rarity: 5,
    });
    expect(
      sonatas
        .filter((entry) => entry.source.kind !== "technical-fixture")
        .map((entry) => entry.id),
    ).toEqual([
      "trailblazing-star",
      "void-thunder",
      "thread-of-severed-fate",
      "rejuvenating-glow",
    ]);
    expect(
      mainEchoes
        .filter((entry) => entry.source.kind !== "technical-fixture")
        .map((entry) => entry.name),
    ).toEqual([
      "Sigillum",
      "Nightmare: Thundering Mephis",
      "Reminiscence: Threnodian - Leviathan",
      "Fallacy of No Return",
    ]);
    expect(calcharo).toMatchObject({
      name: "Calcharo",
      element: "electro",
      weaponType: "broadblade",
      rarity: 5,
    });
    expect(calcharoPreset).toMatchObject({
      weapon: { weaponId: "lustrous-razor", level: 90, rank: 1 },
      sonataId: "void-thunder",
      mainEchoId: "nightmare-thundering-mephis",
    });
  });

  it("documente le kit Lv10 et les inconnues temporelles sans timeline DPS", () => {
    expect(aemeath.combat?.level10Only).toBe(true);
    expect(aemeath.combat?.actions.find((entry) => entry.id === "finale")?.multipliers).toEqual([{ percent: 1789.29, hits: 1 }]);
    expect(aemeath.combat?.effects.find((entry) => entry.id === "starburst-icd")?.internalCooldown).toEqual({ seconds: 8, scope: "target" });
    expect(aemeath.combat?.actions.every((entry) => entry.castDurationSeconds.confidence === "unknown")).toBe(true);
    expect(aemeath.combat?.unknowns).toHaveLength(6);
    expect(aemeath.combat?.rotations[0]).toMatchObject({
      policy: "no-quickswap",
      totalDurationSeconds: { value: 11.69, confidence: "community-calculation" },
    });
  });

  it("intègre Chisa et son équipement par les mêmes catalogues génériques",()=>{
    expect(chisa).toMatchObject({name:"Chisa",element:"havoc",weaponType:"broadblade",rarity:5,combat:{level10Only:false}});
    expect(chisaPreset).toMatchObject({characterLevel:90,sequence:0,weapon:{weaponId:"kumokiri",level:90,rank:1},sonataId:"thread-of-severed-fate",mainEchoId:"reminiscence-threnodian-leviathan"});
    expect(chisaPreset.echoLoadout?.echoes).toHaveLength(5);
    expect(weapons.find(entry=>entry.id==="kumokiri")?.level90Stats).toEqual({baseAttack:500,displayBaseAttack:500,critRate:36});
  });
});
