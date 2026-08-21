import { describe, expect, it } from "vitest";
import {
  generatedPreciseCharacterBoxAudit,
  generatedPreciseCharacterBoxBaselines,
} from "@/generated/precise-character-box-baselines";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import {
  preciseDpsLoadoutResonators,
  preciseDpsLoadoutWeapons,
} from "./precise-dps-loadouts";

const rosterIds = [
  "phrolova",
  "denia",
  "lynae",
  "mornye",
  "qiuyuan",
  "jinhsi",
  "galbrena",
  "iuno",
  "shorekeeper",
  "hiyuki",
] as const;

type RosterId = (typeof rosterIds)[number];

const sorted = (values: readonly string[]) => [...values].sort();

const finitePanelValues = (stats: (typeof generatedPreciseCharacterBoxBaselines)[RosterId]) => [
  stats.hp,
  stats.attack,
  stats.defense,
  stats.critRate,
  stats.critDamage,
  stats.energyRegen,
  stats.healingBonus,
  stats.tuneBreakBoost,
  ...Object.values(stats.elementalDamageBonus),
  ...Object.values(stats.damageTypeBonus),
];

describe("precise Character Box roster acceptance", () => {
  it("keeps one exact 10R1 identity set across loadouts, baselines and audits", () => {
    expect(sorted(preciseDpsLoadoutResonators.map((entry) => entry.id))).toEqual(
      sorted(rosterIds),
    );
    expect(sorted(preciseDpsLoadoutWeapons.map((entry) => entry.resonatorId))).toEqual(
      sorted(rosterIds),
    );
    expect(sorted(Object.keys(generatedPreciseCharacterBoxBaselines))).toEqual(
      sorted(rosterIds),
    );
    expect(sorted(Object.keys(generatedPreciseCharacterBoxAudit))).toEqual(
      sorted(rosterIds),
    );
  });

  it("keeps every signature weapon paired with the matching resonator and GameDatabase audit", () => {
    for (const id of rosterIds) {
      const resonator = preciseDpsLoadoutResonators.find((entry) => entry.id === id);
      const loadout = preciseDpsLoadoutWeapons.find((entry) => entry.resonatorId === id);
      expect(resonator, `${id} resonator`).toBeDefined();
      expect(loadout, `${id} weapon`).toBeDefined();
      expect(loadout?.weapon.type, `${id} weapon type`).toBe(resonator?.weaponType);
      expect(loadout?.weapon.id, `${id} reviewed signature`).toBe(
        generatedPreciseCharacterBoxAudit[id].weaponId,
      );
    }
  });

  it("keeps 11 visible precise presets: one per resonator plus Denia's second reviewed variant", () => {
    expect(preciseCharacterBoxPresets).toHaveLength(11);
    for (const id of rosterIds) {
      const presets = preciseCharacterBoxPresets.filter(
        (entry) => entry.resonatorId === id,
      );
      expect(presets, `${id} preset count`).toHaveLength(id === "denia" ? 2 : 1);
      for (const preset of presets) {
        const weapon = preciseDpsLoadoutWeapons.find(
          (entry) => entry.resonatorId === id,
        )?.weapon;
        expect(preset.characterLevel).toBe(90);
        expect(preset.sequence).toBe(0);
        expect(preset.progression).toEqual({
          inherentSkillsUnlocked: true,
          minorFortesUnlocked: true,
        });
        expect(preset.weapon).toEqual({
          weaponId: weapon?.id,
          level: 90,
          rank: 1,
        });
        expect(preset.echoLoadout?.echoes).toHaveLength(5);
        expect(
          preset.notes.some((note) =>
            note.includes("inclus exactement une fois dans finalStats"),
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps every generated permanent baseline finite and non-negative", () => {
    for (const id of rosterIds) {
      const values = finitePanelValues(generatedPreciseCharacterBoxBaselines[id]);
      expect(values.length, `${id} panel coverage`).toBeGreaterThan(10);
      for (const value of values) {
        expect(Number.isFinite(value), `${id} finite panel value`).toBe(true);
        expect(value, `${id} non-negative panel value`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
