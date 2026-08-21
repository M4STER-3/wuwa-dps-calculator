import { describe, expect, it } from "vitest";
import { createBuildFromPreset } from "./character-box";
import { resolvePersonalLoadout } from "./personal-dps-lab";
import { mainEchoes, presets } from "@/data/catalog";

const legacyIds = [
  "augusta",
  "brant",
  "cantarella",
  "carlotta",
  "cartethyia",
  "changli",
  "ciaccona",
] as const;

const expectedSonatas: Readonly<Record<(typeof legacyIds)[number], readonly string[]>> = {
  augusta: ["sonata-set:20", "sonata-set:3"],
  brant: ["sonata-set:14"],
  cantarella: ["sonata-set:12"],
  carlotta: ["sonata-set:10"],
  cartethyia: ["sonata-set:17"],
  changli: ["sonata-set:2"],
  ciaccona: ["sonata-set:16"],
};

describe("legacy 10R1 equipment runtime promotion", () => {
  it("keeps five reviewed Echoes and resolves a canonical equipped Main Echo for all seven", () => {
    for (const resonatorId of legacyIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      expect(preset.echoLoadout?.echoes, `${resonatorId} Echo loadout`).toHaveLength(5);
      expect(preset.mainEchoId, `${resonatorId} Main Echo id`).toBeDefined();
      expect(
        preset.echoLoadout?.echoes.some((echo) => echo.echoId === preset.mainEchoId),
        `${resonatorId} Main Echo must be one of the five equipped Echoes`,
      ).toBe(true);
      expect(mainEchoes.some((echo) => echo.id === preset.mainEchoId), `${resonatorId} Main Echo catalog`).toBe(true);
    }
  });

  it("derives every active Sonata tier from the actual five Echoes without unresolved ids", () => {
    for (const resonatorId of legacyIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const build = createBuildFromPreset(preset, {
        id: `legacy-equipment-${resonatorId}`,
        now: "2026-08-20T20:30:00.000Z",
      });
      const loadout = resolvePersonalLoadout(build);

      expect(loadout.supported, `${resonatorId} Personal loadout`).toBe(true);
      expect(loadout.mainEcho, `${resonatorId} Main Echo runtime`).toBeDefined();
      expect(loadout.mainEcho?.effects?.length, `${resonatorId} Main Echo personal effects`).toBeGreaterThan(0);
      expect(
        loadout.sonatas.map((sonata) => sonata.id).sort(),
        `${resonatorId} Echo-derived Sonata ids`,
      ).toEqual([...expectedSonatas[resonatorId]].sort());
      expect(
        loadout.diagnostics.filter((diagnostic) =>
          diagnostic.code.startsWith("unresolved-sonata") ||
          diagnostic.code.startsWith("unresolved-main-echo"),
        ),
        `${resonatorId} equipment diagnostics`,
      ).toEqual([]);
    }
  });

  it("keeps Main Echo temporary/passive bonuses outside finalStats", () => {
    for (const resonatorId of legacyIds) {
      const preset = presets.find((entry) => entry.resonatorId === resonatorId)!;
      const build = createBuildFromPreset(preset, {
        id: `legacy-panel-${resonatorId}`,
        now: "2026-08-20T20:31:00.000Z",
      });
      expect(build.finalStats).toEqual(preset.finalStats);
      expect(build.finalStats).not.toBe(preset.finalStats);
    }
  });
});
