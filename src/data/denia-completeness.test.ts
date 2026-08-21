import { describe, expect, it } from "vitest";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";

const resonator = findPreciseDpsResonator("denia")!;
const weapon = findPreciseDpsWeapon("denia")!;
const presets = preciseCharacterBoxPresets.filter(
  (entry) => entry.resonatorId === "denia",
);

describe("Denia completion audit", () => {
  it("keeps the reviewed permanent Character Box package and both mode variants", () => {
    expect(resonator).toMatchObject({
      id: "denia",
      element: "fusion",
      rarity: 5,
      weaponType: "rectifier",
    });
    expect(weapon).toMatchObject({
      id: "precise-denia-signature",
      name: "Forged Dwarf Star",
      rarity: 5,
      level90Stats: { baseAttack: 500, critRate: 36 },
    });

    expect(presets).toHaveLength(2);
    expect(presets.map((entry) => entry.id).sort()).toEqual([
      "denia-s0-l90-signature-precise-fusion-burst",
      "denia-s0-l90-signature-precise-tune-strain",
    ]);

    for (const preset of presets) {
      expect(preset).toMatchObject({
        resonatorId: "denia",
        characterLevel: 90,
        sequence: 0,
        progression: {
          inherentSkillsUnlocked: true,
          minorFortesUnlocked: true,
        },
        weapon: { weaponId: weapon.id, level: 90, rank: 1 },
      });
      expect(preset.echoLoadout?.echoes).toHaveLength(5);
      expect(preset.mainEchoId).toBeDefined();
      expect(preset.notes?.some((note) => note.includes("inclus exactement une fois dans finalStats"))).toBe(true);
    }
  });

  it("keeps exact Lv1-Lv10 GameDatabase rows on every projected Denia damage action", () => {
    const projectedDamageActions = (resonator.combat?.actions ?? []).filter(
      (action) => action.multipliers.length > 0,
    );

    expect(projectedDamageActions.length).toBeGreaterThan(20);
    for (const action of projectedDamageActions) {
      expect(action.multipliersByTalentLevel?.[1], `${action.id} Lv1`).toBeDefined();
      expect(action.multipliersByTalentLevel?.[10], `${action.id} Lv10`).toBeDefined();
    }
  });

  it("keeps the signature permanent ATK marker upstream and its temporary windows runtime-only", () => {
    const permanent = weapon.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-forged-dwarf-star-permanent",
    )?.structuredEffect;
    const liberationWindow = weapon.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-forged-dwarf-star-liberation-window",
    )?.structuredEffect;
    const teamAtkWindow = weapon.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-forged-dwarf-star-team-atk-window",
    )?.structuredEffect;

    expect(permanent?.activationPolicy).toBe("initially-active");
    expect(permanent?.rules).toHaveLength(1);
    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(liberationWindow?.lifecycle?.duration).toEqual({ kind: "fixed", seconds: 5 });
    expect(liberationWindow?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
    expect(teamAtkWindow?.lifecycle?.duration).toEqual({ kind: "fixed", seconds: 15 });
    expect(teamAtkWindow?.rules.every((rule) => rule.accounting === "runtime")).toBe(true);
  });
});
