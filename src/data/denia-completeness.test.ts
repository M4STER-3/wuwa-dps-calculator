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

  it("keeps permanent minor Fortes and signature passive out of runtime-only duplication", () => {
    const permanentEffects = resonator.combat?.effects.filter(
      (effect) => effect.structuredEffect?.activationPolicy === "initially-active",
    ) ?? [];

    expect(
      permanentEffects.some((effect) =>
        effect.structuredEffect?.rules.some(
          (rule) => rule.accounting === "already-in-final-stats",
        ),
      ),
    ).toBe(true);
  });
});
