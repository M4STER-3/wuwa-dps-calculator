import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import {
  calculateActionLab,
  DEFAULT_LAB_TARGET,
  resolvePersonalLoadout,
  simulateRotationLab,
} from "@/domain/personal-dps-lab";
import { presets, resonators, weapons } from "./catalog";

const projectedIds = [
  "augusta",
  "brant",
  "cantarella",
  "carlotta",
  "cartethyia",
  "changli",
  "ciaccona",
] as const;

describe("universal 10R1 combat projection", () => {
  it("gives every generated Resonator an exact Lv90 basis and executable damage actions", () => {
    for (const resonatorId of projectedIds) {
      const resonator = resonators.find((entry) => entry.id === resonatorId)!;
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const weapon = weapons.find((entry) => entry.id === preset.weapon.weaponId)!;
      const actions = resonator.combat?.actions ?? [];

      expect(resonator.baseStats?.filter((entry) => entry.level === 90), resonatorId).toHaveLength(1);
      expect(weapon.level90Stats?.baseAttack, resonatorId).toBeGreaterThan(0);
      expect(actions.length, resonatorId).toBeGreaterThan(0);
      expect(new Set(actions.map((action) => action.id)).size, resonatorId).toBe(actions.length);

      for (const action of actions) {
        expect(action.level, `${resonatorId}:${action.id}`).toBe(10);
        expect(action.multipliers.length, `${resonatorId}:${action.id}`).toBeGreaterThan(0);
        expect(
          action.multipliers.every(
            (group) => group.percent >= 0 && Number.isInteger(group.hits) && group.hits > 0,
          ),
          `${resonatorId}:${action.id}`,
        ).toBe(true);
        expect(
          Object.keys(action.multipliersByTalentLevel ?? {}).sort((a, b) => Number(a) - Number(b)),
          `${resonatorId}:${action.id}`,
        ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
      }

      const build = createBuildFromPreset(preset, {
        id: `projection-${resonatorId}`,
        now: "2026-08-19T00:00:00.000Z",
      });
      const loadout = resolvePersonalLoadout(build);
      expect(loadout.supported, resonatorId).toBe(true);
      expect(loadout.baseStatBasis?.attack, resonatorId).toBeGreaterThan(0);

      const directlyCalculable = actions.find((action) => action.damageType !== undefined);
      expect(directlyCalculable, resonatorId).toBeDefined();
      const result = calculateActionLab({
        loadout,
        actionId: directlyCalculable!.id,
        stats: build.finalStats,
        target: DEFAULT_LAB_TARGET,
      });
      expect(result?.damage.status, resonatorId).toBe("supported");
    }
  });

  it("calculates a positive personal DPS rotation for every generated Resonator", () => {
    for (const resonatorId of projectedIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const build = createBuildFromPreset(preset, {
        id: `rotation-${resonatorId}`,
        now: "2026-08-19T00:00:00.000Z",
      });
      const loadout = resolvePersonalLoadout(build);
      const rotation = simulateRotationLab(
        loadout,
        build.finalStats,
        DEFAULT_LAB_TARGET,
      );

      expect(rotation, resonatorId).toBeDefined();
      expect(rotation!.rotationDurationSeconds, resonatorId).toBeGreaterThan(0);
      expect(rotation!.personalDamage.expected, resonatorId).toBeGreaterThan(0);
      expect(rotation!.personalDps.expected, resonatorId).toBeGreaterThan(0);
      expect(rotation!.coverage.directDamageActions, resonatorId).toBeGreaterThan(0);
    }
  });

  it("applies promoted Echo stats to generated presets exactly upstream of combat", () => {
    for (const resonatorId of projectedIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      expect(preset.echoLoadout?.echoes, resonatorId).toHaveLength(5);
      expect(
        preset.notes.some((note) => /finalStats exactement une fois/i.test(note)),
        resonatorId,
      ).toBe(true);
    }
  });
});
