import { describe, expect, it } from "vitest";
import { aemeathPreset } from "@/data/aemeath-combat";
import { calcharoPreset } from "@/data/calcharo-runtime";
import { chisaPreset } from "@/data/chisa-combat";
import { sonatas } from "@/data/catalog";
import { verinaPreset } from "@/data/verina-runtime";
import type { RecommendedBuildPreset, UserBuild } from "./models";
import {
  DEFAULT_LAB_TARGET,
  resolvePersonalLoadout,
  simulateRotationLab,
} from "./personal-dps-lab";
import { resolvePersonalSonataLoadout } from "./personal-sonata-loadout";

const richPresets = [aemeathPreset, calcharoPreset, chisaPreset, verinaPreset] as const;

const asBuild = (preset: RecommendedBuildPreset): UserBuild => ({
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

describe("rich Character Box compatibility with Echo-derived Sonata runtime", () => {
  for (const preset of richPresets) {
    it(`${preset.resonatorId} keeps its established rich loadout resolvable`, () => {
      const build = asBuild(preset);
      const sonataResolution = resolvePersonalSonataLoadout(build, sonatas);
      const loadout = resolvePersonalLoadout(build);

      expect(
        loadout.diagnostics.filter((diagnostic) =>
          diagnostic.code.startsWith("unresolved-") ||
          diagnostic.code === "invalid-echo-derived-sonata-loadout",
        ),
      ).toEqual([]);
      expect(loadout.supported).toBe(true);

      if (preset.echoLoadout?.echoes.length) {
        expect(sonataResolution.diagnostics).toEqual([]);
        expect(sonataResolution.resolution?.unresolvedActiveSetIds).toEqual([]);
        expect(sonataResolution.sonatas.length).toBeGreaterThan(0);
        expect(loadout.sonatas.length).toBeGreaterThan(0);
      }

      if (preset.mainEchoId) {
        expect(loadout.mainEcho).toBeDefined();
      }

      expect(() =>
        simulateRotationLab(loadout, build.finalStats, DEFAULT_LAB_TARGET),
      ).not.toThrow();
    });
  }
});
