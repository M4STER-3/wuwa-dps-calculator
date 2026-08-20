import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import rawRegistry from "./precise-dps-future-registry.json";

type Registry = {
  version: number;
  entries: readonly { id: string; name: string; signatureWeaponName: string }[];
};

type Database = {
  weapons: readonly {
    name: string;
    baseStats?: {
      secondaryStat?: {
        stat: string;
        unit: string;
        progression: { points: readonly { level: number; value: number; ascended?: boolean }[] };
      };
    };
  }[];
};

describe("precise Character Box signature secondary probe", () => {
  it("prints exact Lv90 secondary stats for the precise roster", () => {
    const registry = rawRegistry as Registry;
    const database = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/data/wuwa/game-database-v1.json"), "utf8"),
    ) as Database;

    const rows = registry.entries.map((entry) => {
      const weapon = database.weapons.find((candidate) => candidate.name === entry.signatureWeaponName);
      expect(weapon, `weapon ${entry.signatureWeaponName}`).toBeDefined();
      const secondary = weapon?.baseStats?.secondaryStat;
      expect(secondary, `secondary ${entry.signatureWeaponName}`).toBeDefined();
      const level90 = secondary?.progression.points.filter((point) => point.level === 90) ?? [];
      expect(level90.length, `Lv90 secondary ${entry.signatureWeaponName}`).toBeGreaterThan(0);
      const selected = level90.find((point) => point.ascended === true) ?? level90.at(-1)!;
      return {
        resonatorId: entry.id,
        weaponName: entry.signatureWeaponName,
        stat: secondary!.stat,
        unit: secondary!.unit,
        value: selected.value,
      };
    });

    expect(rows).toHaveLength(10);
    console.log("[PRECISE_SIGNATURE_SECONDARY]", JSON.stringify(rows));
  });
});
