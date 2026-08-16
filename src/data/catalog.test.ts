import { describe, expect, it } from "vitest";
import { mainEchoes, presets, resonators, sonatas, weapons } from "./catalog";

const aemeath = resonators.find((entry) => entry.id === "aemeath")!;
const aemeathPreset = presets.find((entry) => entry.resonatorId === "aemeath")!;

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
      expect(sonatas.some((entry) => entry.id === preset.sonataId)).toBe(true);
      expect(mainEchoes.some((entry) => entry.id === preset.mainEchoId)).toBe(true);
    }
  });

  it("intègre Aemeath comme donnée réelle et conserve les fixtures restantes explicites", () => {
    expect(aemeath.source.kind).toBe("multi-source-verified");
    expect(aemeath.name).toBe("Aemeath");
    expect(aemeath.element).toBe("fusion");
    expect(aemeath.weaponType).toBe("sword");
    expect(aemeath.combat?.modes).toEqual(["tune-rupture", "fusion-burst"]);
    expect(aemeath.resonanceChain.map((chain) => chain.sequence)).toEqual([1, 2, 3, 4, 5, 6]);

    const fixtureEntries = [resonators, weapons, sonatas, mainEchoes, presets]
      .flatMap((collection) => [...collection])
      .filter((entry) => entry.id.startsWith("fixture-") || entry.id.startsWith("preset-fixture-"));
    expect(fixtureEntries.length).toBeGreaterThan(0);
    expect(fixtureEntries.every((entry) => entry.source.kind === "technical-fixture")).toBe(true);
  });

  it("fournit le preset S0 Lv90 complet et son équipement vérifié", () => {
    expect(aemeathPreset).toMatchObject({
      id: "aemeath-s0-endgame-v0.1",
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
      finalStats: { tuneBreakBoost: 10 },
    });
    expect(aemeathPreset.source.kind).toBe("community-recommendation");
    expect(aemeathPreset.recommendedTargets?.attack).toEqual({ minimum: 2000, maximum: 2400 });
    expect(aemeathPreset.finalStats.attack).toBe(2000);
  });

  it("n'expose qu'un équipement réel vérifié pour Aemeath", () => {
    expect(
      weapons
        .filter(
          (entry) =>
            entry.type === aemeath.weaponType &&
            entry.source.kind !== "technical-fixture",
        )
        .map((entry) => entry.name),
    ).toEqual(["Everbright Polestar"]);
    expect(
      sonatas
        .filter((entry) => entry.source.kind !== "technical-fixture")
        .map((entry) => entry.id),
    ).toEqual(["trailblazing-star"]);
    expect(
      mainEchoes
        .filter((entry) => entry.source.kind !== "technical-fixture")
        .map((entry) => entry.name),
    ).toEqual(["Sigillum"]);
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
});
