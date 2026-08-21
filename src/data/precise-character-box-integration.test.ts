import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "@/domain/character-box";
import {
  DEFAULT_LAB_TARGET,
  resolvePersonalLoadout,
  simulateRotationLab,
} from "@/domain/personal-dps-lab";
import { generatedPreciseCharacterBoxBaselines } from "@/generated/precise-character-box-baselines";
import { presets, resonators, weapons } from "./catalog";
import { preciseDpsFutureScenarios } from "./precise-dps-future";

const preciseIds = [
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

const unresolvedCodes = new Set([
  "unresolved-resonator-id",
  "unresolved-weapon-id",
  "missing-base-stat-basis",
]);

describe("precise Character Box roster integration", () => {
  it("exposes all ten precise Resonators, signatures and Lv90 presets", () => {
    for (const resonatorId of preciseIds) {
      const resonator = resonators.find((entry) => entry.id === resonatorId);
      const preset = presets.find((entry) => entry.resonatorId === resonatorId);
      const weapon = preset
        ? weapons.find((entry) => entry.id === preset.weapon.weaponId)
        : undefined;

      expect(resonator, `${resonatorId} resonator`).toBeDefined();
      expect(resonator?.portrait?.src, `${resonatorId} portrait`).toMatch(
        /^\/assets\/wuwa\/objects\/[a-f0-9]+\.webp$/,
      );
      expect(preset, `${resonatorId} preset`).toMatchObject({
        characterLevel: 90,
        sequence: 0,
        progression: {
          inherentSkillsUnlocked: true,
          minorFortesUnlocked: true,
        },
        weapon: { level: 90, rank: 1 },
      });
      expect(preset?.echoLoadout?.echoes, `${resonatorId} five-Echo loadout`).toHaveLength(5);
      expect(preset?.echoLoadout?.mainEchoId, `${resonatorId} equipped Main Echo`).toBeDefined();
      expect(preset?.mainEchoId, `${resonatorId} runtime Main Echo`).toBeDefined();
      expect(weapon?.type).toBe(resonator?.weaponType);
      expect(weapon?.rarity).toBe(5);
    }
  });

  it("copies the reviewed permanent panel into UserBuild without rebuilding equipment", () => {
    for (const resonatorId of preciseIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const build = createBuildFromPreset(preset, {
        id: `test-${resonatorId}`,
        now: "2026-08-20T13:30:00.000Z",
      });

      expect(build.finalStats).toEqual(preset.finalStats);
      expect(build.finalStats).not.toBe(preset.finalStats);
      expect(build.finalStats.elementalDamageBonus).not.toBe(
        preset.finalStats.elementalDamageBonus,
      );
      expect(build.finalStats.hp).toBeGreaterThan(0);
      expect(build.finalStats.attack).toBeGreaterThan(0);
      expect(build.finalStats.defense).toBeGreaterThan(0);

      const loadout = resolvePersonalLoadout(build);
      expect(loadout.supported, `${resonatorId} Personal DPS loadout`).toBe(true);
      expect(loadout.baseStatBasis, `${resonatorId} exact base stat basis`).toBeDefined();
      expect(
        loadout.diagnostics.filter((entry) => unresolvedCodes.has(entry.code)),
        `${resonatorId} unresolved diagnostics`,
      ).toEqual([]);
    }
  });

  it("keeps Jinhsi Ages of Harvest and equipped Echo Spectro stats exactly once", () => {
    const preset = presets.find((entry) => entry.resonatorId === "jinhsi")!;
    const baseline = generatedPreciseCharacterBoxBaselines.jinhsi;

    expect(baseline.elementalDamageBonus.spectro).toBe(12);
    expect(
      preset.finalStats.elementalDamageBonus.spectro -
        baseline.elementalDamageBonus.spectro,
    ).toBe(60);
    expect(preset.finalStats.elementalDamageBonus.spectro).toBe(72);
  });

  it("routes every new Character Box build into an executable precise Personal DPS scenario", () => {
    for (const resonatorId of preciseIds) {
      expect(
        preciseDpsFutureScenarios.some((scenario) => scenario.resonatorId === resonatorId),
        `${resonatorId} precise scenario`,
      ).toBe(true);

      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const build = createBuildFromPreset(preset, {
        id: `simulation-${resonatorId}`,
        now: "2026-08-20T13:35:00.000Z",
      });
      const loadout = resolvePersonalLoadout(build);
      const simulation = simulateRotationLab(
        loadout,
        build.finalStats,
        DEFAULT_LAB_TARGET,
      );

      expect(simulation, `${resonatorId} Personal DPS simulation`).toBeDefined();
    }
  });
});
