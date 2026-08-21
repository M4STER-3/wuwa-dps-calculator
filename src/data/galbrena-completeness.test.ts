import { describe, expect, it } from "vitest";
import {
  generatedPreciseCharacterBoxAudit,
  generatedPreciseCharacterBoxBaselines,
} from "@/generated/precise-character-box-baselines";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import { GALBRENA } from "./precise-dps-galbrena";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const resonator = findPreciseDpsResonator("galbrena")!;
const weapon = findPreciseDpsWeapon("galbrena")!;
const presets = preciseCharacterBoxPresets.filter(
  (entry) => entry.resonatorId === "galbrena",
);

describe("Galbrena completion audit", () => {
  it("keeps the reviewed Character Box package exactly once", () => {
    expect(resonator).toMatchObject({
      id: "galbrena",
      element: "fusion",
      rarity: 5,
      weaponType: "pistols",
    });
    expect(weapon).toMatchObject({
      id: "precise-galbrena-signature",
      name: "Lux & Umbra",
      rarity: 5,
      level90Stats: {
        baseAttack: 587.5,
        displayBaseAttack: 588,
      },
    });

    // Character Box permanent secondaries are sourced universally from GameDatabase,
    // not reconstructed from the partial legacy Weapon.level90Stats display shape.
    expect(generatedPreciseCharacterBoxAudit.galbrena.weaponSecondary).toEqual({
      stat: "Crit. DMG",
      amount: 48.6,
    });
    expect(generatedPreciseCharacterBoxBaselines.galbrena.critDamage).toBeCloseTo(214.6, 10);

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id: "galbrena-s0-l90-signature-precise",
      resonatorId: "galbrena",
      characterLevel: 90,
      sequence: 0,
      progression: {
        inherentSkillsUnlocked: true,
        minorFortesUnlocked: true,
      },
      weapon: { weaponId: weapon.id, level: 90, rank: 1 },
    });
    expect(presets[0]?.echoLoadout?.echoes).toHaveLength(5);
    expect(
      presets[0]?.notes?.some((note) => note.includes("inclus exactement une fois dans finalStats")),
    ).toBe(true);
  });

  it("keeps all reviewed native identities and the manual Outro without synthetic source ids", () => {
    for (const id of Object.values(GALBRENA)) {
      const action = resonator.combat?.actions.find((candidate) => candidate.id === id);
      expect(action, id).toBeDefined();
      expect(action?.multipliers.length, `${id} damage row`).toBeGreaterThan(0);
    }
    const outro = resonator.combat?.actions.find((action) => action.id === GALBRENA.outro);
    expect(outro?.multipliers).toEqual([
      { percent: 79.5, hits: 3 },
      { percent: 556.5, hits: 1 },
    ]);
  });

  it("owns exact resource caps and permanent/runtime separation", () => {
    expect(resonator.combat?.resources.map(({ id, cap }) => [id, cap])).toEqual([
      ["afterflame", 40],
      ["sinflame", 100],
      ["purging-flame", 100],
    ]);

    const permanent = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-permanent",
    )?.structuredEffect;
    const heavy = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-heavy-window",
    )?.structuredEffect;
    const echo = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-echo-window",
    )?.structuredEffect;
    const both = weapon.effects?.find(
      (effect) => effect.structuredEffect?.id === "precise-lux-umbra-both-windows",
    )?.structuredEffect;

    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(heavy?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
    expect(echo?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
    expect(both?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
  });

  it("keeps current Heavy/Echo classifications and Demon mechanics structured", () => {
    const action = (id: string) =>
      resonator.combat?.actions.find((candidate) => candidate.id === id);
    for (const id of [
      GALBRENA.basic1,
      GALBRENA.basic2,
      GALBRENA.basic3,
      GALBRENA.encroach,
      GALBRENA.ascent,
      GALBRENA.ravage,
    ]) {
      expect(action(id)?.damageType, id).toBe("heavyAttack");
    }
    for (const id of [
      GALBRENA.basic4,
      GALBRENA.liberation,
      GALBRENA.seraphic4,
      GALBRENA.seraphic5,
    ]) {
      expect(action(id)?.damageType, id).toBe("echoSkill");
    }

    const hellfire = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-galbrena-hellfire-window",
    )?.structuredEffect;
    expect(hellfire?.lifecycle?.duration).toEqual({ kind: "fixed", seconds: 14 });
    expect(hellfire?.rules[0]?.accounting).toBe("runtime");
  });
});
