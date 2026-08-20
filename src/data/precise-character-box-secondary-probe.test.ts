import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import rawRegistry from "./precise-dps-future-registry.json";

type Registry = {
  version: number;
  entries: readonly { id: string; name: string; signatureWeaponName: string }[];
};

type ExternalIds = { wuwa?: string };
type Database = {
  characters: readonly { name: string; externalIds?: ExternalIds }[];
  weapons: readonly {
    name: string;
    externalIds?: ExternalIds;
    baseStats?: {
      secondaryStat?: {
        stat: string;
        unit: string;
        progression: { points: readonly { level: number; value: number; ascended?: boolean }[] };
      };
    };
  }[];
};
type Manifest = {
  entities: {
    characters: Record<string, { assets: Record<string, { path: string }> }>;
    weapons: Record<string, { assets: Record<string, { path: string }> }>;
  };
};

describe("precise Character Box projection probe", () => {
  it("prints exact Lv90 signature stats and local UI bindings", () => {
    const registry = rawRegistry as Registry;
    const database = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/wuwa/game-database-v1.json"), "utf8")) as Database;
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "public/assets/wuwa/manifest.json"), "utf8")) as Manifest;

    const rows = registry.entries.map((entry) => {
      const character = database.characters.find((candidate) => candidate.name === entry.name);
      const weapon = database.weapons.find((candidate) => candidate.name === entry.signatureWeaponName);
      expect(character, `character ${entry.name}`).toBeDefined();
      expect(weapon, `weapon ${entry.signatureWeaponName}`).toBeDefined();
      const secondary = weapon?.baseStats?.secondaryStat;
      expect(secondary, `secondary ${entry.signatureWeaponName}`).toBeDefined();
      const level90 = secondary?.progression.points.filter((point) => point.level === 90) ?? [];
      const selected = level90.find((point) => point.ascended === true) ?? level90.at(-1)!;
      const resonatorAssetId = character?.externalIds?.wuwa;
      const weaponAssetId = weapon?.externalIds?.wuwa;
      expect(resonatorAssetId).toMatch(/^\d+$/);
      expect(weaponAssetId).toMatch(/^\d+$/);
      const portraitPath = manifest.entities.characters[resonatorAssetId!]?.assets["list-roleheadicon"]?.path;
      const weaponPath = manifest.entities.weapons[weaponAssetId!]?.assets["list-icon"]?.path;
      expect(portraitPath).toMatch(/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/);
      expect(weaponPath).toMatch(/^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/);
      return { resonatorId: entry.id, resonatorAssetId, portraitPath, weaponName: entry.signatureWeaponName, weaponAssetId, weaponPath, stat: secondary!.stat, value: selected.value };
    });

    expect(rows).toHaveLength(10);
    console.log("[PRECISE_CHARACTER_BOX_PROBE]", JSON.stringify(rows));
  });
});
