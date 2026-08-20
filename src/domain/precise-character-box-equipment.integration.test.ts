import { describe, expect, it } from "vitest";
import { preciseCharacterBoxPresets } from "@/data/precise-character-box-presets";
import { DEFAULT_LAB_TARGET, resolvePersonalLoadout, simulateRotationLab } from "./personal-dps-lab";
import { resolvePersonalSonataLoadout } from "./personal-sonata-loadout";
import { sonatas } from "@/data/catalog";
import type { UserBuild } from "./models";

const asBuild = (preset: (typeof preciseCharacterBoxPresets)[number]): UserBuild => ({
  id: `test:${preset.id}`,
  resonatorId: preset.resonatorId,
  sourcePresetId: preset.id,
  characterLevel: preset.characterLevel,
  sequence: preset.sequence,
  skillLevels: { ...preset.skillLevels },
  weapon: { ...preset.weapon },
  finalStats: {
    ...preset.finalStats,
    elementalDamageBonus: { ...preset.finalStats.elementalDamageBonus },
    damageTypeBonus: { ...preset.finalStats.damageTypeBonus },
  },
  ...(preset.echoLoadout ? { echoLoadout: preset.echoLoadout } : {}),
  ...(preset.sonataId ? { sonataId: preset.sonataId } : {}),
  ...(preset.mainEchoId ? { mainEchoId: preset.mainEchoId } : {}),
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
});

describe("precise Character Box equipment integration", () => {
  it("publishes ten Resonators and two distinct Denia variants", () => {
    expect(preciseCharacterBoxPresets).toHaveLength(11);
    expect(new Set(preciseCharacterBoxPresets.map((preset) => preset.resonatorId)).size).toBe(10);
    expect(preciseCharacterBoxPresets.filter((preset) => preset.resonatorId === "denia")).toHaveLength(2);
  });

  for (const preset of preciseCharacterBoxPresets) {
    it(`${preset.id} resolves five Echoes, reached Sonata tiers and its Main Echo`, () => {
      expect(preset.echoLoadout?.echoes).toHaveLength(5);
      expect(preset.echoLoadout?.mainEchoId).toBeTruthy();
      expect(preset.mainEchoId).toBeTruthy();

      const build = asBuild(preset);
      const sonata = resolvePersonalSonataLoadout(build, sonatas);
      expect(sonata.diagnostics).toEqual([]);
      expect(sonata.resolution?.unresolvedActiveSetIds).toEqual([]);
      expect(sonata.sonatas.length).toBeGreaterThan(0);

      const loadout = resolvePersonalLoadout(build);
      expect(loadout.diagnostics.filter((entry) => entry.code.startsWith("unresolved-"))).toEqual([]);
      expect(loadout.mainEcho).toBeDefined();
      expect(loadout.mainEcho?.action).toBeDefined();
      expect(loadout.sonatas.length).toBeGreaterThan(0);
      expect(loadout.supported).toBe(true);

      const simulation = simulateRotationLab(
        loadout,
        build.finalStats,
        DEFAULT_LAB_TARGET,
      );
      expect(simulation).toBeDefined();
      const mainEchoActionId = loadout.mainEcho!.action!.id;
      expect(
        simulation!.audits.some((audit) => audit.actionId === mainEchoActionId),
      ).toBe(true);
      expect(simulation!.perAction[mainEchoActionId]).toBeDefined();
    });
  }
});
